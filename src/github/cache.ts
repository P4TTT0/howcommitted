import "server-only";
import type { Redis } from "@upstash/redis";
import type { Repo, UserProfile, YearSummary } from "@/domain/types";
import type { Failure } from "./failure";
import type { ReposResult } from "./queries";

/** The slice of the Redis client the cache layer uses (easy to fake in tests). */
export type Store = Pick<Redis, "get" | "set" | "del" | "eval">;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const TTL = {
  user: DAY,
  yearPast: 30 * DAY,
  /** How long the current year counts as fresh. */
  yearCurrent: 6 * HOUR,
  /** How long a stale current year is kept around to be served while it refreshes. */
  yearCurrentRetained: 7 * DAY,
  repos: DAY,
  missing: HOUR,
  /** Short cooldown so waiters and retries do not hammer a failing upstream. */
  failure: 30,
} as const;

/** Bump the version segment to invalidate everything at once. */
const VERSION = "v1";

/** A cached year plus when it was fetched, so the current year can go stale. */
export type CachedYear = { summary: YearSummary; fetchedAt: string };

export function isCurrentYear(year: number, now: Date): boolean {
  return year >= now.getUTCFullYear();
}

/** Physical Redis lifetime of a cached year. */
export function ttlForYear(year: number, now: Date): number {
  return isCurrentYear(year, now) ? TTL.yearCurrentRetained : TTL.yearPast;
}

/** Past years never go stale; the current year does after `TTL.yearCurrent`. */
export function isYearStale(entry: CachedYear, now: Date): boolean {
  return (
    isCurrentYear(entry.summary.year, now) &&
    now.getTime() - Date.parse(entry.fetchedAt) > TTL.yearCurrent * 1000
  );
}

export function createCache(store: Store, prefix: string) {
  // GitHub logins are case-insensitive: normalize so "Torvalds" and "torvalds" share keys.
  const key = (kind: string, login: string, ...rest: (string | number)[]) =>
    [`${prefix}${VERSION}`, kind, login.toLowerCase(), ...rest].join(":");

  return {
    key,
    getUser: (login: string) => store.get<UserProfile>(key("user", login)),
    setUser: (user: UserProfile) =>
      store.set(key("user", user.login), user, { ex: TTL.user }),

    getYear: (login: string, year: number) =>
      store.get<CachedYear>(key("year", login, year)),
    setYear: (login: string, summary: YearSummary, now: Date) =>
      store.set(
        key("year", login, summary.year),
        { summary, fetchedAt: now.toISOString() } satisfies CachedYear,
        { ex: ttlForYear(summary.year, now) },
      ),

    getRepos: (login: string) => store.get<ReposResult>(key("repos", login)),
    setRepos: (login: string, repos: Repo[], truncated: boolean) =>
      store.set(
        key("repos", login),
        { repos, truncated } satisfies ReposResult,
        {
          ex: TTL.repos,
        },
      ),

    /** Negative cache for logins GitHub does not know. */
    isMissing: async (login: string) =>
      (await store.get(key("missing", login))) !== null,
    markMissing: (login: string) =>
      store.set(key("missing", login), 1, { ex: TTL.missing }),

    /** Last failed generation, served to waiters instead of retrying. */
    getFailure: (login: string) => store.get<Failure>(key("failed", login)),
    setFailure: (login: string, failure: Failure) =>
      store.set(key("failed", login), failure, { ex: TTL.failure }),
  };
}

export type Cache = ReturnType<typeof createCache>;
