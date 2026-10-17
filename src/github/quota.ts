import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { UNKNOWN_IP, type Visitor } from "./visitor";

/** Cold (uncached) profile generations per anonymous visitor per day. */
export const COLD_GENERATIONS_PER_DAY = 2;
/** Preview lookups per IP per minute. */
export const PREVIEWS_PER_MINUTE = 30;
/** Requests with no usable IP all share one bucket, so it is much tighter. */
export const PREVIEWS_PER_MINUTE_UNKNOWN_IP = 10;

const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

/** A charged cold generation. Refund it when the generation fails. */
export type ColdCharge = { refund(): Promise<void> };

type Counters = Pick<Redis, "get" | "incr" | "decr" | "expire">;

/**
 * Soft gates only: clearing cookies or changing IP bypasses them. The global
 * circuit breaker is the hard gate.
 */
export function createQuota(
  redis: Redis,
  prefix: string,
  now: () => Date = () => new Date(),
) {
  const counters: Counters = redis;
  const preview = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PREVIEWS_PER_MINUTE, "1 m"),
    prefix: `${prefix}v1:quota:preview`,
  });
  const previewUnknown = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PREVIEWS_PER_MINUTE_UNKNOWN_IP, "1 m"),
    prefix: `${prefix}v1:quota:preview-unknown`,
  });

  // Daily counters per identity. Plain INCR/DECR (not a rate limiter) so a
  // failed generation can hand its run back.
  const counterKey = (kind: "cookie" | "ip", id: string) =>
    `${prefix}v1:quota:cold:${kind}:${id}:${now().toISOString().slice(0, 10)}`;

  return {
    /**
     * Charges one cold generation. Both identities are checked before either
     * is charged, so a visitor blocked on one never burns budget on the other.
     * An unknown IP is not charged (it would be one shared bucket for everyone).
     * Returns null when the visitor has no free runs left.
     */
    async chargeColdGeneration(visitor: Visitor): Promise<ColdCharge | null> {
      const keys = [counterKey("cookie", visitor.cookieId)];
      if (visitor.ip !== UNKNOWN_IP) keys.push(counterKey("ip", visitor.ip));

      const used = await Promise.all(
        keys.map((key) => counters.get<number>(key)),
      );
      if (used.some((count) => (count ?? 0) >= COLD_GENERATIONS_PER_DAY)) {
        return null;
      }

      await Promise.all(
        keys.map(async (key) => {
          if ((await counters.incr(key)) === 1) {
            await counters.expire(key, COUNTER_TTL_SECONDS);
          }
        }),
      );
      return {
        refund: async () => {
          await Promise.all(keys.map((key) => counters.decr(key)));
        },
      };
    },

    async allowPreview(ip: string): Promise<boolean> {
      const limiter = ip === UNKNOWN_IP ? previewUnknown : preview;
      return (await limiter.limit(`ip:${ip}`)).success;
    },
  };
}

export type Quota = ReturnType<typeof createQuota>;
