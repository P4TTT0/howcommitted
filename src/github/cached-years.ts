import "server-only";
import type { UserProfile, YearSummary } from "@/domain/types";
import type { Cache } from "./cache";
import { logEvent } from "./log";
import { yearsNeeded } from "./profile";

export type CachedYears = { user: UserProfile; years: YearSummary[] };

/**
 * Reads the user and every contribution year from the cache, and nothing else.
 * It never calls GitHub, never takes the lock, never charges the quota and
 * never schedules a refresh: it is for callers that must stay free, such as
 * crawlers fetching Open Graph images. Stale years are returned as they are.
 *
 * Resolves null unless the data is complete (a partial total would mislead),
 * and also when Redis fails: the caller falls back to something generic.
 */
export async function readCachedYears(
  login: string,
  cache: Cache,
  now: Date = new Date(),
): Promise<CachedYears | null> {
  try {
    const user = await cache.getUser(login);
    if (!user) return null;
    const entries = await Promise.all(
      yearsNeeded(user, now).map((year) => cache.getYear(login, year)),
    );
    const years: YearSummary[] = [];
    for (const entry of entries) {
      if (!entry) return null;
      years.push(entry.summary);
    }
    years.sort((a, b) => a.year - b.year);
    return { user, years };
  } catch (error) {
    logEvent("store_error", { op: "readCachedYears", message: String(error) });
    return null;
  }
}
