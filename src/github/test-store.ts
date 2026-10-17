import type { Store } from "./cache";

/**
 * Test-only in-memory stand-in for the Redis client. Not imported by app code,
 * so it carries no "server-only" marker and stays out of the production bundle.
 */
export function createTestStore() {
  const values = new Map<string, unknown>();
  const ttls = new Map<string, number>();

  const store = {
    async get(key: string) {
      return values.has(key) ? structuredClone(values.get(key)) : null;
    },
    async set(
      key: string,
      value: unknown,
      options?: { nx?: boolean; ex?: number },
    ) {
      if (options?.nx && values.has(key)) return null;
      values.set(key, structuredClone(value));
      if (options?.ex !== undefined) ttls.set(key, options.ex);
      return "OK";
    },
    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) {
        if (values.delete(key)) removed++;
        ttls.delete(key);
      }
      return removed;
    },
    /** Only understands the compare-and-delete script used by the lock. */
    async eval(_script: string, keys: string[], args: unknown[]) {
      const key = keys[0] as string;
      if (values.get(key) !== args[0]) return 0;
      values.delete(key);
      ttls.delete(key);
      return 1;
    },
  };

  return { store: store as unknown as Store, values, ttls };
}
