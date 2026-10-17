import "server-only";
import type { Store } from "./cache";

/** Covers the generation deadline (50 s) plus margin; short enough to heal after a crash. */
export const LOCK_TTL_SECONDS = 75;

/** Deletes the key only when it still holds our token (atomic compare-and-delete). */
const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export type Lock = {
  /** Returns a release function, or null when someone else holds the lock. */
  acquire(name: string): Promise<(() => Promise<void>) | null>;
};

/** Redis SET NX lock. Used to coalesce concurrent cold fetches of one profile. */
export function createLock(store: Store, prefix: string): Lock {
  return {
    async acquire(name) {
      const key = `${prefix}v1:lock:${name.toLowerCase()}`;
      const token = crypto.randomUUID();
      const acquired = await store.set(key, token, {
        nx: true,
        ex: LOCK_TTL_SECONDS,
      });
      if (acquired === null) return null;
      return async () => {
        // The lock may have expired and been taken by someone else: only delete our own.
        await store.eval(RELEASE_SCRIPT, [key], [token]);
      };
    },
  };
}
