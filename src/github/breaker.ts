import "server-only";
import type { Store } from "./cache";
import type { RateLimitInfo } from "./graphql";

/** Anonymous cold generations stop when the server token drops below this share. */
export const BREAKER_THRESHOLD = 0.2;

type TokenBudget = Pick<RateLimitInfo, "remaining" | "limit" | "resetAt">;

/** Global circuit breaker driven by the rate limit GitHub reports on every response. */
export function createBreaker(store: Store, prefix: string) {
  const key = `${prefix}v1:budget:server`;

  return {
    async record(rateLimit: RateLimitInfo | null): Promise<void> {
      if (!rateLimit) return;
      const budget: TokenBudget = {
        remaining: rateLimit.remaining,
        limit: rateLimit.limit,
        resetAt: rateLimit.resetAt,
      };
      await store.set(key, budget, { ex: 60 * 60 });
    },

    async isOpen(now: Date): Promise<boolean> {
      const budget = await store.get<TokenBudget>(key);
      if (!budget || budget.limit <= 0) return false;
      // Once the window resets the stored number is stale: let traffic through again.
      if (Date.parse(budget.resetAt) <= now.getTime()) return false;
      return budget.remaining < budget.limit * BREAKER_THRESHOLD;
    },
  };
}

export type Breaker = ReturnType<typeof createBreaker>;
