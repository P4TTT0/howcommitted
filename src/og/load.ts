import "server-only";
import { createCache } from "@/github/cache";
import { readCachedYears } from "@/github/cached-years";
import { getRedis, keyPrefix } from "@/github/config";
import { buildPosterModel, type PosterModel } from "./poster";

/** Crawlers give up quickly; a slow Redis must not turn into a hung image. */
const READ_BUDGET_MS = 2_500;

/**
 * The poster model for a login, from the cache only. Resolves null when the
 * profile is not (fully) cached, when Redis is slow or down, or when the
 * environment is not configured: callers then render the generic poster.
 * Never reaches GitHub and never touches the quota.
 */
export async function loadCachedPoster(
  login: string,
): Promise<PosterModel | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const cache = createCache(getRedis(), keyPrefix());
    const cached = await Promise.race([
      readCachedYears(login, cache),
      new Promise<null>((resolve) => {
        timer = setTimeout(resolve, READ_BUDGET_MS, null);
      }),
    ]);
    return cached ? buildPosterModel(cached.user, cached.years) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
