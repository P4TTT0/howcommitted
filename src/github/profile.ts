import "server-only";
import type { ProfileData, UserProfile, YearSummary } from "@/domain/types";
import type { Breaker } from "./breaker";
import { type Cache, type CachedYear, isYearStale } from "./cache";
import { mapWithConcurrency } from "./concurrency";
import { type Failure, toFailure } from "./failure";
import type { GithubError, GraphqlResult, RateLimitInfo } from "./graphql";
import type { Lock } from "./lock";
import { logEvent } from "./log";
import {
  fetchRepos,
  fetchUserPreview,
  fetchYear,
  type ReposResult,
} from "./queries";
import type { ColdCharge } from "./quota";
import type { Visitor } from "./visitor";

/** Parallel year requests. Keeps us well under GitHub's secondary limits. */
export const YEAR_CONCURRENCY = 6;
/** Single budget for one request: lock waits plus the whole fan-out. Vercel allows 60 s. */
export const GENERATION_DEADLINE_MS = 50_000;
/** A new fetch is not started with less than this left of the deadline. */
export const MIN_GENERATION_BUDGET_MS = 5_000;
/** Waiters back off between these bounds, with jitter. */
export const WAIT_MIN_MS = 500;
export const WAIT_MAX_MS = 2_000;
const WAIT_BASE_MS = 1_000;

export type PreviewResult =
  | { status: "ok"; user: UserProfile }
  | Failure
  | { status: "degraded"; reason: "circuit_open" | "store_down" };

export type ProfileResult =
  | {
      status: "ok";
      profile: ProfileData;
      source: "cache" | "fresh";
      /** True when the owner has more repositories than we page through. */
      reposTruncated: boolean;
    }
  | Failure
  | { status: "login_required"; reason: "quota_exhausted" }
  | {
      status: "degraded";
      reason: "circuit_open" | "busy" | "store_down";
    };

export type ProfileDeps = {
  /** Lazy so cache hits work without a GitHub token configured. */
  getToken: () => string;
  cache: Cache;
  breaker: Breaker;
  lock: Lock;
  /**
   * Charges one anonymous cold generation. Resolves null when the visitor has
   * no free runs left.
   */
  chargeColdGeneration: (visitor: Visitor) => Promise<ColdCharge | null>;
  /**
   * Runs a task after the response is sent (for example Next.js `after`). Used
   * to refresh a stale current year. Without it, stale data is served as is.
   */
  scheduleRefresh?: (task: () => Promise<void>) => void;
  /** Test knobs. */
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  deadlineMs?: number;
  minBudgetMs?: number;
};

/** now/sleep/random/deadline resolved once per request. */
type Context = {
  deps: ProfileDeps;
  /**
   * The signed-in visitor's own GitHub token, or null for the server token.
   * It never touches the shared breaker or the anonymous quota, and its
   * failures are never recorded for other visitors.
   */
  userToken: string | null;
  /** A signed-in visitor (even when the server token is used): skips the anonymous quota. */
  signedIn: boolean;
  /** Set when GitHub rejected `userToken` (revoked or expired). */
  tokenRejected: boolean;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  deadline: number;
  signal: AbortSignal;
};

/** Cost bookkeeping for the one-line generation log. */
type Tally = { cost: number; remaining: number | null; years: number };

function newTally(): Tally {
  return { cost: 0, remaining: null, years: 0 };
}

function createContext(
  deps: ProfileDeps,
  userToken: string | null = null,
  signedIn = false,
): Context {
  const now = deps.now ?? (() => new Date());
  const deadlineMs = deps.deadlineMs ?? GENERATION_DEADLINE_MS;
  return {
    deps,
    userToken,
    signedIn,
    tokenRejected: false,
    now,
    sleep: deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))),
    random: deps.random ?? Math.random,
    deadline: now().getTime() + deadlineMs,
    signal: AbortSignal.timeout(deadlineMs),
  };
}

/** The token for this request's GitHub calls: the visitor's own, else the server's. */
function tokenFor(ctx: Context): string {
  return ctx.userToken ?? ctx.deps.getToken();
}

/** A Redis failure on a path that must not proceed without Redis. */
class StoreDownError extends Error {}

/** Runs a store operation; failure is logged and replaced by `fallback`. */
async function orElse<T>(
  op: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logEvent("store_error", { op, message: String(error) });
    return fallback;
  }
}

/** Runs a store operation that gates cold generation: failure fails closed. */
async function mustSucceed<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new StoreDownError(String(error));
  }
}

const STORE_DOWN: ProfileResult = { status: "degraded", reason: "store_down" };

export function yearsNeeded(user: UserProfile, now: Date): number[] {
  // The cached preview can predate the current year's first contribution.
  return [...new Set([...user.contributionYears, now.getUTCFullYear()])].sort(
    (a, b) => b - a,
  );
}

function recordCost(tally: Tally, rateLimit: RateLimitInfo | null): void {
  if (!rateLimit) return;
  tally.cost += rateLimit.cost;
  tally.remaining =
    tally.remaining === null
      ? rateLimit.remaining
      : Math.min(tally.remaining, rateLimit.remaining);
}

async function fetchAndRecord<T>(
  ctx: Context,
  tally: Tally,
  call: () => Promise<GraphqlResult<T>>,
): Promise<GraphqlResult<T>> {
  const result = await call();
  recordCost(tally, result.rateLimit);
  if (ctx.userToken) {
    // The circuit breaker guards the server token's budget only: a visitor's
    // own budget must neither open nor close it.
    if (!result.ok && result.error.kind === "unauthorized") {
      ctx.tokenRejected = true;
    }
    return result;
  }
  const { breaker } = ctx.deps;
  await orElse(
    "breaker",
    () =>
      !result.ok && result.error.kind === "rate_limited"
        ? breaker.recordRateLimited(result.error.resetAt, ctx.now())
        : breaker.record(result.rateLimit, ctx.now()),
    undefined,
  );
  return result;
}

async function failureFrom(
  login: string,
  error: GithubError,
  ctx: Context,
): Promise<Failure> {
  if (error.kind === "not_found") {
    await orElse(
      "markMissing",
      () => ctx.deps.cache.markMissing(login),
      undefined,
    );
  }
  return toFailure(error);
}

/** Exact-login preview, cached 24 h. Costs 1 point on a miss; never counts toward the quota. */
export async function getPreview(
  login: string,
  deps: ProfileDeps,
): Promise<PreviewResult> {
  const ctx = createContext(deps);
  const { cache, breaker } = deps;
  if (await orElse("isMissing", () => cache.isMissing(login), false)) {
    return { status: "not_found" };
  }
  const cached = await orElse("getUser", () => cache.getUser(login), null);
  if (cached) return { status: "ok", user: cached };

  // A cache miss costs a GitHub point: stop spending when the budget is low.
  try {
    if (await mustSucceed(() => breaker.isOpen(ctx.now()))) {
      return { status: "degraded", reason: "circuit_open" };
    }
  } catch (error) {
    if (!(error instanceof StoreDownError)) throw error;
    return { status: "degraded", reason: "store_down" };
  }
  return fetchUser(login, ctx, newTally());
}

/** Fetches the preview from GitHub and caches it. */
async function fetchUser(
  login: string,
  ctx: Context,
  tally: Tally,
): Promise<{ status: "ok"; user: UserProfile } | Failure> {
  const { cache } = ctx.deps;
  const result = await fetchAndRecord(ctx, tally, () =>
    fetchUserPreview(tokenFor(ctx), login, ctx.signal),
  );
  if (!result.ok) return failureFrom(login, result.error, ctx);
  if (!ctx.userToken) {
    await orElse("setUser", () => cache.setUser(result.data), undefined);
  }
  return { status: "ok", user: result.data };
}

type Snapshot = {
  user: UserProfile | null;
  years: Map<number, YearSummary>;
  /** Cached years to refresh: the current year past its window, or a year that ended after it was fetched. */
  staleYears: number[];
  repos: ReposResult | null;
};

/** Cache read errors count as misses: the lock and breaker decide whether we may regenerate. */
async function readSnapshot(login: string, ctx: Context): Promise<Snapshot> {
  const { cache } = ctx.deps;
  const now = ctx.now();
  const user = await orElse("getUser", () => cache.getUser(login), null);
  const years = new Map<number, YearSummary>();
  const staleYears: number[] = [];
  if (user) {
    const entries = await Promise.all(
      yearsNeeded(user, now).map((year) =>
        orElse<CachedYear | null>(
          "getYear",
          () => cache.getYear(login, year),
          null,
        ),
      ),
    );
    for (const entry of entries) {
      if (!entry) continue;
      years.set(entry.summary.year, entry.summary);
      if (isYearStale(entry, now)) staleYears.push(entry.summary.year);
    }
  }
  const repos = await orElse("getRepos", () => cache.getRepos(login), null);
  return { user, years, staleYears, repos };
}

type Complete = { profile: ProfileData; reposTruncated: boolean };

function completeProfile(snapshot: Snapshot, now: Date): Complete | null {
  const { user, repos } = snapshot;
  if (!user || !repos) return null;
  if (yearsNeeded(user, now).some((year) => !snapshot.years.has(year))) {
    return null;
  }
  return {
    profile: {
      user,
      repos: repos.repos,
      years: [...snapshot.years.values()].sort((a, b) => a.year - b.year),
    },
    reposTruncated: repos.truncated,
  };
}

type Lookup = { snapshot: Snapshot; result: ProfileResult | null };

/** Negative cache, then a complete cached profile. Stale years are served and refreshed. */
async function lookup(login: string, ctx: Context): Promise<Lookup> {
  const { cache, scheduleRefresh } = ctx.deps;
  const snapshot = await readSnapshot(login, ctx);
  if (await orElse("isMissing", () => cache.isMissing(login), false)) {
    return { snapshot, result: { status: "not_found" } };
  }
  const complete = completeProfile(snapshot, ctx.now());
  if (!complete) return { snapshot, result: null };
  if (snapshot.staleYears.length > 0 && scheduleRefresh) {
    // After a failed refresh, serve stale data quietly instead of retrying on every view.
    const backedOff = await orElse(
      "hasRefreshFailure",
      () => cache.hasRefreshFailure(login),
      true,
    );
    if (!backedOff) {
      scheduleRefresh(() => refreshYears(login, snapshot.staleYears, ctx.deps));
    }
  }
  return { snapshot, result: { status: "ok", source: "cache", ...complete } };
}

export type ProfileOptions = {
  /**
   * The signed-in visitor's own GitHub token. A cold generation then spends
   * their GitHub budget instead of the anonymous quota and the server token,
   * and stays out of the circuit breaker. The lock and shared cache reads still
   * apply, but what they fetch is never written to the shared cache: their token
   * may see data an anonymous visitor cannot.
   */
  userToken?: string | null;
  /**
   * The login `userToken` belongs to. Required for the token to be used: without
   * it the visitor counts as anonymous. When it equals the requested login
   * (case-insensitive) the server token fetches instead, so anything only the
   * owner can see (such as private contribution counts) can never reach the
   * shared cache. They still skip the anonymous quota.
   */
  viewerLogin?: string | null;
  /** Called when GitHub rejected `userToken`; the request is then served as anonymous. */
  onTokenRejected?: () => void;
};

/** Internal: the visitor's own token was rejected by GitHub (revoked or expired). */
type TokenRejected = { status: "token_rejected" };

const TOKEN_REJECTED: TokenRejected = { status: "token_rejected" };

/**
 * Full profile. Served from cache when complete. Otherwise one request holds a
 * Redis lock and generates it; concurrent requests for the same login poll the
 * lock cheaply, then read what the leader cached (or the failure it recorded).
 * A rejected visitor token degrades to the anonymous path instead of failing.
 */
export async function getProfile(
  login: string,
  visitor: Visitor,
  deps: ProfileDeps,
  options: ProfileOptions = {},
): Promise<ProfileResult> {
  const signedIn = Boolean(options.userToken && options.viewerLogin);
  const ownProfile =
    signedIn && options.viewerLogin?.toLowerCase() === login.toLowerCase();
  const first = await resolveProfile(
    login,
    visitor,
    createContext(
      deps,
      signedIn && !ownProfile ? (options.userToken ?? null) : null,
      signedIn,
    ),
  );
  if (first.status !== "token_rejected") return first;
  options.onTokenRejected?.();
  const retry = await resolveProfile(login, visitor, createContext(deps));
  // Unreachable: an anonymous context has no visitor token to reject.
  return retry.status === "token_rejected"
    ? { status: "upstream_error", message: "Unexpected token rejection" }
    : retry;
}

async function resolveProfile(
  login: string,
  visitor: Visitor,
  ctx: Context,
): Promise<ProfileResult | TokenRejected> {
  const { deps } = ctx;

  const cached = await lookup(login, ctx);
  if (cached.result) return cached.result;

  for (let attempt = 0; ; attempt++) {
    let release: Awaited<ReturnType<Lock["acquire"]>>;
    try {
      release = await deps.lock.acquire(login);
    } catch (error) {
      logEvent("store_error", { op: "lock", message: String(error) });
      return STORE_DOWN;
    }
    if (release) {
      try {
        // Too little budget left to finish a fetch: do not start one that
        // would only be cut off and leave a misleading failure marker.
        if (
          ctx.deadline - ctx.now().getTime() <
          (deps.minBudgetMs ?? MIN_GENERATION_BUDGET_MS)
        ) {
          return { status: "degraded", reason: "busy" };
        }
        return await generate(login, visitor, ctx);
      } finally {
        // A failed release must never replace a good result; the lock TTL heals it.
        await orElse("unlock", release, undefined);
      }
    }
    if (ctx.now().getTime() >= ctx.deadline) {
      return { status: "degraded", reason: "busy" };
    }
    await ctx.sleep(waitDelay(attempt, ctx.random));
  }
}

function waitDelay(attempt: number, random: () => number): number {
  const ceiling = Math.min(WAIT_MAX_MS, WAIT_BASE_MS * 2 ** attempt);
  return WAIT_MIN_MS + random() * (ceiling - WAIT_MIN_MS);
}

async function generate(
  login: string,
  visitor: Visitor,
  ctx: Context,
): Promise<ProfileResult | TokenRejected> {
  const startedAt = ctx.now().getTime();
  const tally = newTally();
  let result: ProfileResult | TokenRejected;
  try {
    result = await generateCold(login, visitor, ctx, tally);
  } catch (error) {
    if (!(error instanceof StoreDownError)) throw error;
    logEvent("store_error", { op: "gate", message: error.message });
    result = STORE_DOWN;
  }
  logEvent("generation", {
    login: login.toLowerCase(),
    auth: ctx.userToken ? "user" : "server",
    signedIn: ctx.signedIn,
    status: result.status,
    source: result.status === "ok" ? result.source : null,
    years: tally.years,
    ms: ctx.now().getTime() - startedAt,
    remaining: tally.remaining,
    cost: tally.cost,
  });
  return result;
}

async function generateCold(
  login: string,
  visitor: Visitor,
  ctx: Context,
  tally: Tally,
): Promise<ProfileResult | TokenRejected> {
  const { cache, breaker } = ctx.deps;

  // Another request may have finished while we waited for the lock.
  const { snapshot, result: cached } = await lookup(login, ctx);
  if (cached) return cached;

  // A recent failure is served to everyone instead of being retried at once.
  const failed = await orElse(
    "getFailure",
    () => cache.getFailure(login),
    null,
  );
  if (failed) return failed;

  // The breaker protects the server token only; a signed-in visitor spends
  // their own budget and is not stopped by it.
  if (!ctx.userToken && (await mustSucceed(() => breaker.isOpen(ctx.now())))) {
    return { status: "degraded", reason: "circuit_open" };
  }

  // Only a profile with no history cached at all is a new cold generation.
  // The preview route caches the user for free, so the user does not count.
  // Completing partial data or refreshing a year is free for the visitor.
  // Signed-in visitors skip the anonymous quota: their own token pays.
  const needsCharge = !ctx.signedIn && !hasHistoryCached(snapshot);
  const charge = needsCharge
    ? await mustSucceed(() => ctx.deps.chargeColdGeneration(visitor))
    : null;
  if (needsCharge && !charge) {
    return { status: "login_required", reason: "quota_exhausted" };
  }

  const refund = () =>
    charge
      ? orElse("refund", () => charge.refund(), undefined)
      : Promise.resolve();

  let outcome: Fetched;
  try {
    outcome = await fetchMissing(login, ctx, tally, snapshot);
  } catch (error) {
    // For example a missing GitHub token: the visitor must not lose a run.
    await refund();
    throw error;
  }
  if ("failure" in outcome) {
    const { failure } = outcome;
    // Nothing is cached for others: the failure belongs to this visitor's token.
    if (ctx.tokenRejected) return TOKEN_REJECTED;
    // A failed generation hands the run back, except for unknown users:
    // refunding those would make probing logins free.
    // Unknown users already have the longer negative cache instead of a marker.
    if (failure.status !== "not_found") {
      await refund();
      // Failures of a visitor's own token (limits, errors) are theirs alone:
      // never served to everyone else.
      if (!ctx.userToken) {
        await orElse(
          "setFailure",
          () => cache.setFailure(login, failure),
          undefined,
        );
      }
    }
    return failure;
  }
  return { status: "ok", source: "fresh", ...outcome };
}

type Fetched = Complete | { failure: Failure };

function hasHistoryCached(snapshot: Snapshot): boolean {
  return snapshot.years.size > 0 || snapshot.repos !== null;
}

async function fetchMissing(
  login: string,
  ctx: Context,
  tally: Tally,
  snapshot: Snapshot,
): Promise<Fetched> {
  let user = snapshot.user;
  if (!user) {
    const preview = await fetchUser(login, ctx, tally);
    if (preview.status !== "ok") return { failure: preview };
    user = preview.user;
  }

  const yearsFailure = await fetchMissingYears(
    login,
    ctx,
    tally,
    snapshot,
    user,
  );
  if (yearsFailure) return { failure: yearsFailure };

  const repos = await fetchMissingRepos(login, ctx, tally, snapshot);
  if ("failure" in repos) return repos;

  const complete = completeProfile(
    { ...snapshot, user, repos: repos.repos },
    ctx.now(),
  );
  return (
    complete ?? {
      failure: { status: "upstream_error", message: "Incomplete profile data" },
    }
  );
}

/**
 * Fetches the years that are not cached and caches each as it lands, so a
 * retry only pays for the rest. The first rate limit or timeout aborts the
 * in-flight requests and stops launching new ones. Returns the failure, if any.
 */
async function fetchMissingYears(
  login: string,
  ctx: Context,
  tally: Tally,
  snapshot: Snapshot,
  user: UserProfile,
): Promise<Failure | null> {
  // Years that went stale (for example one that ended since it was fetched) are refetched too.
  const missing = yearsNeeded(user, ctx.now()).filter(
    (year) => !snapshot.years.has(year) || snapshot.staleYears.includes(year),
  );
  const done = new Set<number>();
  const fanOut = new AbortController();
  const signal = AbortSignal.any([ctx.signal, fanOut.signal]);
  const state: { failure: GithubError | null } = { failure: null };

  await mapWithConcurrency(
    missing,
    YEAR_CONCURRENCY,
    async (year) => {
      tally.years += 1;
      const result = await fetchAndRecord(ctx, tally, () =>
        fetchYear(tokenFor(ctx), login, year, signal),
      );
      if (result.ok) {
        done.add(year);
        snapshot.years.set(year, result.data);
        // A visitor's token may see data an anonymous visitor cannot: never shared.
        if (!ctx.userToken) {
          await orElse(
            "setYear",
            () => ctx.deps.cache.setYear(login, result.data, ctx.now()),
            undefined,
          );
        }
        return;
      }
      // Keep the first failure: the siblings we abort report a timeout of their own.
      state.failure ??= result.error;
      if (
        result.error.kind === "rate_limited" ||
        result.error.kind === "timeout" ||
        result.error.kind === "unauthorized"
      ) {
        fanOut.abort();
      }
    },
    () => signal.aborted,
  );

  if (state.failure) return failureFrom(login, state.failure, ctx);
  // Launches were skipped because the deadline passed.
  if (missing.some((year) => !done.has(year))) {
    return { status: "timeout" };
  }
  return null;
}

async function fetchMissingRepos(
  login: string,
  ctx: Context,
  tally: Tally,
  snapshot: Snapshot,
): Promise<{ repos: ReposResult } | { failure: Failure }> {
  if (snapshot.repos) return { repos: snapshot.repos };
  const result = await fetchAndRecord(ctx, tally, () =>
    fetchRepos(tokenFor(ctx), login, ctx.signal),
  );
  if (!result.ok) {
    return { failure: await failureFrom(login, result.error, ctx) };
  }
  const { repos, truncated } = result.data;
  if (!ctx.userToken) {
    await orElse(
      "setRepos",
      () => ctx.deps.cache.setRepos(login, repos, truncated),
      undefined,
    );
  }
  return { repos: result.data };
}

/**
 * Background refresh of stale years. Skips when someone else is generating or
 * the breaker is open. A failure leaves a short marker so refreshes back off.
 */
async function refreshYears(
  login: string,
  years: number[],
  deps: ProfileDeps,
): Promise<void> {
  const ctx = createContext(deps);
  const markFailed = () =>
    orElse(
      "markRefreshFailure",
      () => deps.cache.markRefreshFailure(login),
      undefined,
    );
  try {
    const release = await deps.lock.acquire(login);
    if (!release) return;
    try {
      if (await deps.breaker.isOpen(ctx.now())) return;
      for (const year of years) {
        const result = await fetchAndRecord(ctx, newTally(), () =>
          fetchYear(deps.getToken(), login, year, ctx.signal),
        );
        if (!result.ok) {
          await markFailed();
          return;
        }
        await deps.cache.setYear(login, result.data, ctx.now());
      }
    } finally {
      await orElse("unlock", release, undefined);
    }
  } catch (error) {
    logEvent("refresh_error", { login, message: String(error) });
    await markFailed();
  }
}
