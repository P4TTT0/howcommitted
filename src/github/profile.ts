import "server-only";
import type {
  ProfileData,
  Repo,
  UserProfile,
  YearSummary,
} from "@/domain/types";
import type { Breaker } from "./breaker";
import type { Cache } from "./cache";
import { mapWithConcurrency } from "./concurrency";
import type { GithubError, GraphqlResult } from "./graphql";
import type { Lock } from "./lock";
import { fetchRepos, fetchUserPreview, fetchYear } from "./queries";
import type { Visitor } from "./visitor";

/** Parallel year requests. Keeps us well under GitHub's secondary limits. */
export const YEAR_CONCURRENCY = 6;
/** How long a request waits for another request's fetch of the same profile. */
export const COALESCE_WAIT_MS = 15_000;
const COALESCE_POLL_MS = 400;

export type PreviewResult =
  | { status: "ok"; user: UserProfile }
  | { status: "not_found" }
  | { status: "rate_limited"; resetAt: string | null }
  | { status: "timeout" }
  | { status: "upstream_error"; message: string };

export type ProfileResult =
  | { status: "ok"; profile: ProfileData; source: "cache" | "fresh" }
  | Exclude<PreviewResult, { status: "ok" }>
  | { status: "login_required"; reason: "quota_exhausted" }
  | { status: "degraded"; reason: "circuit_open" | "busy" };

export type ProfileDeps = {
  /** Lazy so cache hits work without a GitHub token configured. */
  getToken: () => string;
  cache: Cache;
  breaker: Breaker;
  lock: Lock;
  /** Consumes one anonymous cold generation. Resolves false when exhausted. */
  consumeColdGeneration: (visitor: Visitor) => Promise<boolean>;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

type Failure = Exclude<PreviewResult, { status: "ok" }>;

function toFailure(error: GithubError): Failure {
  switch (error.kind) {
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", resetAt: error.resetAt };
    case "timeout":
      return { status: "timeout" };
    case "upstream":
      return { status: "upstream_error", message: error.message };
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Exact-login preview, cached 24 h. Costs 1 point on a miss; never counts toward the quota. */
export async function getPreview(
  login: string,
  deps: ProfileDeps,
): Promise<PreviewResult> {
  if (await deps.cache.isMissing(login)) return { status: "not_found" };
  const cached = await deps.cache.getUser(login);
  if (cached) return { status: "ok", user: cached };

  const result = await fetchAndRecord(deps, () =>
    fetchUserPreview(deps.getToken(), login),
  );
  if (!result.ok) {
    if (result.error.kind === "not_found") await deps.cache.markMissing(login);
    return toFailure(result.error);
  }
  await deps.cache.setUser(result.data);
  return { status: "ok", user: result.data };
}

type Snapshot = {
  user: UserProfile | null;
  years: Map<number, YearSummary>;
  repos: Repo[] | null;
};

async function readSnapshot(
  login: string,
  deps: ProfileDeps,
): Promise<Snapshot> {
  const user = await deps.cache.getUser(login);
  const years = new Map<number, YearSummary>();
  if (user) {
    const found = await Promise.all(
      user.contributionYears.map((year) => deps.cache.getYear(login, year)),
    );
    for (const summary of found) if (summary) years.set(summary.year, summary);
  }
  return { user, years, repos: await deps.cache.getRepos(login) };
}

function completeProfile(snapshot: Snapshot): ProfileData | null {
  const { user, repos } = snapshot;
  if (!user || !repos) return null;
  if (user.contributionYears.some((year) => !snapshot.years.has(year))) {
    return null;
  }
  return {
    user,
    repos,
    years: [...snapshot.years.values()].sort((a, b) => a.year - b.year),
  };
}

/**
 * Full profile. Served from cache when complete (free, unlimited). Otherwise a
 * cold generation: one request holds a Redis lock and fetches; concurrent
 * requests for the same login wait and then read the cache.
 */
export async function getProfile(
  login: string,
  visitor: Visitor,
  deps: ProfileDeps,
): Promise<ProfileResult> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const deadline = now().getTime() + COALESCE_WAIT_MS;

  for (;;) {
    if (await deps.cache.isMissing(login)) return { status: "not_found" };
    const cached = completeProfile(await readSnapshot(login, deps));
    if (cached) return { status: "ok", profile: cached, source: "cache" };

    const release = await deps.lock.acquire(login);
    if (release) {
      try {
        return await generateCold(login, visitor, deps);
      } finally {
        await release();
      }
    }

    if (now().getTime() >= deadline) {
      return { status: "degraded", reason: "busy" };
    }
    await sleep(COALESCE_POLL_MS);
  }
}

async function generateCold(
  login: string,
  visitor: Visitor,
  deps: ProfileDeps,
): Promise<ProfileResult> {
  const now = deps.now ?? (() => new Date());

  // Another request may have finished while we were acquiring the lock.
  const snapshot = await readSnapshot(login, deps);
  const cached = completeProfile(snapshot);
  if (cached) return { status: "ok", profile: cached, source: "cache" };

  if (await deps.breaker.isOpen(now())) {
    return { status: "degraded", reason: "circuit_open" };
  }
  if (!(await deps.consumeColdGeneration(visitor))) {
    return { status: "login_required", reason: "quota_exhausted" };
  }

  let user = snapshot.user;
  if (!user) {
    const preview = await getPreview(login, deps);
    if (preview.status !== "ok") return preview;
    user = preview.user;
  }

  const missingYears = user.contributionYears.filter(
    (year) => !snapshot.years.has(year),
  );
  const fetchedYears = await mapWithConcurrency(
    missingYears,
    YEAR_CONCURRENCY,
    async (year) => {
      const result = await fetchAndRecord(deps, () =>
        fetchYear(deps.getToken(), login, year),
      );
      // Cache each year as it lands so a retry after a failure only pays for the rest.
      if (result.ok) await deps.cache.setYear(login, result.data, now());
      return result;
    },
  );
  for (const result of fetchedYears) {
    if (!result.ok) return failureOrMissing(login, result.error, deps);
    snapshot.years.set(result.data.year, result.data);
  }

  let repos = snapshot.repos;
  if (!repos) {
    const result = await fetchAndRecord(deps, () =>
      fetchRepos(deps.getToken(), login),
    );
    if (!result.ok) return failureOrMissing(login, result.error, deps);
    repos = result.data;
    await deps.cache.setRepos(login, repos);
  }

  const profile = completeProfile({ user, years: snapshot.years, repos });
  if (!profile) {
    return { status: "upstream_error", message: "Incomplete profile data" };
  }
  return { status: "ok", profile, source: "fresh" };
}

async function failureOrMissing(
  login: string,
  error: GithubError,
  deps: ProfileDeps,
): Promise<Failure> {
  if (error.kind === "not_found") await deps.cache.markMissing(login);
  return toFailure(error);
}

async function fetchAndRecord<T>(
  deps: ProfileDeps,
  call: () => Promise<GraphqlResult<T>>,
): Promise<GraphqlResult<T>> {
  const result = await call();
  await deps.breaker.record(result.rateLimit);
  return result;
}
