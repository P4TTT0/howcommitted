import "server-only";
import type { Store } from "./cache";
import type { RateLimitInfo } from "./graphql";
import { logEvent } from "./log";

/** Anonymous cold generations stop when the server token drops below this share. */
export const BREAKER_THRESHOLD = 0.2;
/** The stored budget outlives GitHub's hourly window; the reset time decides validity. */
export const BUDGET_TTL_SECONDS = 60 * 60;
/** Assumed lockout when GitHub rate limits us without telling us when it resets. */
export const DEFAULT_LOCKOUT_MS = 60_000;

type TokenBudget = Pick<RateLimitInfo, "remaining" | "limit" | "resetAt">;

function isOpenFor(budget: TokenBudget | null, now: Date): boolean {
  if (!budget || budget.limit <= 0) return false;
  // Once the window resets the stored number is stale: let traffic through again.
  if (Date.parse(budget.resetAt) <= now.getTime()) return false;
  return budget.remaining < budget.limit * BREAKER_THRESHOLD;
}

/** Global circuit breaker driven by the rate limit GitHub reports on every response. */
export function createBreaker(store: Store, prefix: string) {
  const key = `${prefix}v1:budget:server`;

  // Parallel responses of one request would race on read-modify-write: queue them.
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };

  async function write(
    current: TokenBudget | null,
    budget: TokenBudget,
    now: Date,
  ): Promise<void> {
    await store.set(key, budget, { ex: BUDGET_TTL_SECONDS });
    const open = isOpenFor(budget, now);
    if (open !== isOpenFor(current, now)) {
      logEvent("breaker", { open, ...budget });
    }
  }

  return {
    /**
     * Records the budget from a response. Parallel responses can arrive out of
     * order, so within one window the lowest remaining value wins. Writes are
     * serialized per instance; across instances a lost update only delays the
     * breaker by one response.
     */
    record(rateLimit: RateLimitInfo | null, now: Date): Promise<void> {
      if (!rateLimit) return Promise.resolve();
      return serialized(async () => {
        const current = await store.get<TokenBudget>(key);
        const sameWindow = current?.resetAt === rateLimit.resetAt;
        await write(
          current,
          {
            remaining: sameWindow
              ? Math.min(current.remaining, rateLimit.remaining)
              : rateLimit.remaining,
            limit: rateLimit.limit,
            resetAt: rateLimit.resetAt,
          },
          now,
        );
      });
    },

    /** GitHub said "rate limited": the budget is zero until the reset. */
    recordRateLimited(resetAt: string | null, now: Date): Promise<void> {
      return serialized(async () => {
        const current = await store.get<TokenBudget>(key);
        await write(
          current,
          {
            remaining: 0,
            limit: current?.limit || 1,
            resetAt:
              resetAt ??
              new Date(now.getTime() + DEFAULT_LOCKOUT_MS).toISOString(),
          },
          now,
        );
      });
    },

    async isOpen(now: Date): Promise<boolean> {
      return isOpenFor(await store.get<TokenBudget>(key), now);
    },
  };
}

export type Breaker = ReturnType<typeof createBreaker>;
