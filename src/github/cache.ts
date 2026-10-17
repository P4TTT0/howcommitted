import "server-only";
import type { Redis } from "@upstash/redis";
import type { Repo, UserProfile, YearSummary } from "@/domain/types";

/** The slice of the Redis client the cache layer uses (easy to fake in tests). */
export type Store = Pick<Redis, "get" | "set" | "del">;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const TTL = {
  user: DAY,
  yearPast: 30 * DAY,
  yearCurrent: 6 * HOUR,
  repos: DAY,
  missing: HOUR,
} as const;

/** Bump the version segment to invalidate everything at once. */
const VERSION = "v1";

export function ttlForYear(year: number, now: Date): number {
  return year >= now.getUTCFullYear() ? TTL.yearCurrent : TTL.yearPast;
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
      store.get<YearSummary>(key("year", login, year)),
    setYear: (login: string, summary: YearSummary, now: Date) =>
      store.set(key("year", login, summary.year), summary, {
        ex: ttlForYear(summary.year, now),
      }),

    getRepos: (login: string) => store.get<Repo[]>(key("repos", login)),
    setRepos: (login: string, repos: Repo[]) =>
      store.set(key("repos", login), repos, { ex: TTL.repos }),

    /** Negative cache for logins GitHub does not know. */
    isMissing: async (login: string) =>
      (await store.get(key("missing", login))) !== null,
    markMissing: (login: string) =>
      store.set(key("missing", login), 1, { ex: TTL.missing }),
  };
}

export type Cache = ReturnType<typeof createCache>;
