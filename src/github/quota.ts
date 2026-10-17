import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { UNKNOWN_IP, type Visitor } from "./visitor";

/** Cold (uncached) profile generations per anonymous visitor per day. */
export const COLD_GENERATIONS_PER_DAY = 2;
/** Cold generation attempts per IP per minute, whatever the cookie. */
export const COLD_ATTEMPTS_PER_MINUTE = 10;
/** Preview lookups per IP per minute. */
export const PREVIEWS_PER_MINUTE = 30;
/** Requests with no usable IP all share one bucket, so it is much tighter. */
export const PREVIEWS_PER_MINUTE_UNKNOWN_IP = 10;

const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

/** INCR that sets the expiry in the same atomic step, so a counter never lives forever. */
export const CHARGE_SCRIPT = `local count = redis.call("incr", KEYS[1])
if count == 1 then redis.call("expire", KEYS[1], ARGV[1]) end
return count`;

/** DECR that never goes below zero. */
export const REFUND_SCRIPT = `local count = tonumber(redis.call("get", KEYS[1]))
if count and count > 0 then return redis.call("decr", KEYS[1]) end
return 0`;

/** A charged cold generation. Refund it when the generation fails. */
export type ColdCharge = { refund(): Promise<void> };

/**
 * Soft gates only: clearing cookies or changing IP bypasses them. The global
 * circuit breaker is the hard gate.
 */
export function createQuota(
  redis: Redis,
  prefix: string,
  now: () => Date = () => new Date(),
) {
  const limiter = (name: string, max: number) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, "1 m"),
      prefix: `${prefix}v1:quota:${name}`,
    });
  const preview = limiter("preview", PREVIEWS_PER_MINUTE);
  const previewUnknown = limiter(
    "preview-unknown",
    PREVIEWS_PER_MINUTE_UNKNOWN_IP,
  );
  const coldBurst = limiter("cold-burst", COLD_ATTEMPTS_PER_MINUTE);

  // Daily counters per identity: plain counters (not a rate limiter) so a
  // failed generation can hand its run back.
  const counterKey = (kind: "cookie" | "ip", id: string) =>
    `${prefix}v1:quota:cold:${kind}:${id}:${now().toISOString().slice(0, 10)}`;

  const charge = (key: string) =>
    redis.eval<[number], number>(CHARGE_SCRIPT, [key], [COUNTER_TTL_SECONDS]);
  const refund = (keys: string[]) =>
    Promise.allSettled(
      keys.map((key) => redis.eval<[], number>(REFUND_SCRIPT, [key], [])),
    );

  return {
    /**
     * Charges one cold generation. Each identity is charged first and checked
     * after (so concurrent requests cannot both slip under the limit); when
     * either is over, everything charged is rolled back. An unknown IP is not
     * charged (it would be one shared bucket for everyone) but is rate limited.
     * Returns null when the visitor has no free runs left; throws, after rolling
     * back, when the store fails.
     */
    async chargeColdGeneration(visitor: Visitor): Promise<ColdCharge | null> {
      if (!(await coldBurst.limit(`ip:${visitor.ip}`)).success) return null;

      const keys = [counterKey("cookie", visitor.cookieId)];
      if (visitor.ip !== UNKNOWN_IP) keys.push(counterKey("ip", visitor.ip));

      const results = await Promise.allSettled(keys.map(charge));
      const charged = keys.filter((_, i) => results[i]?.status === "fulfilled");
      const failure = results.find((r) => r.status === "rejected");
      const exhausted = results.some(
        (r) => r.status === "fulfilled" && r.value > COLD_GENERATIONS_PER_DAY,
      );

      if (failure || exhausted) {
        await refund(charged);
        if (failure) throw (failure as PromiseRejectedResult).reason;
        return null;
      }

      let refunded = false;
      return {
        refund: async () => {
          if (refunded) return;
          refunded = true;
          await refund(keys);
        },
      };
    },

    async allowPreview(ip: string): Promise<boolean> {
      const active = ip === UNKNOWN_IP ? previewUnknown : preview;
      return (await active.limit(`ip:${ip}`)).success;
    },
  };
}

export type Quota = ReturnType<typeof createQuota>;
