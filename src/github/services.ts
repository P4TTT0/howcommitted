import "server-only";
import { after } from "next/server";
import { createBreaker } from "./breaker";
import { createCache } from "./cache";
import { getRedis, githubToken, keyPrefix } from "./config";
import { createLock } from "./lock";
import type { ProfileDeps } from "./profile";
import { createQuota, type Quota } from "./quota";

export type Services = {
  deps: ProfileDeps;
  quota: Quota;
};

/**
 * Wires the real Redis-backed services. Reads env vars lazily (here, not at
 * import time) so builds and cache-free code paths work without credentials.
 */
export function getServices(): Services {
  const redis = getRedis();
  const prefix = keyPrefix();
  const quota = createQuota(redis, prefix);
  return {
    quota,
    deps: {
      getToken: githubToken,
      cache: createCache(redis, prefix),
      breaker: createBreaker(redis, prefix),
      lock: createLock(redis, prefix),
      chargeColdGeneration: quota.chargeColdGeneration,
      scheduleRefresh: (task) => after(task),
    },
  };
}
