import "server-only";
import type { Store } from "./cache";

/** Longer than a cold profile normally takes, short enough to heal after a crash. */
export const LOCK_TTL_SECONDS = 60;

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
        // Only delete our own lock; it may have expired and been taken by someone else.
        if ((await store.get(key)) === token) await store.del(key);
      };
    },
  };
}
