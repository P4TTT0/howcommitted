import { afterEach, describe, expect, it, vi } from "vitest";
import { createBreaker } from "./breaker";
import { createCache } from "./cache";
import { createLock } from "./lock";
import {
  GENERATION_DEADLINE_MS,
  getPreview,
  getProfile,
  type ProfileDeps,
  WAIT_MAX_MS,
  WAIT_MIN_MS,
} from "./profile";
import { createTestStore } from "./test-store";

const NOW = new Date("2026-10-16T12:00:00Z");
const visitor = { ip: "1.1.1.1", cookieId: "v1" };

const rateLimit = {
  cost: 1,
  remaining: 4900,
  limit: 5000,
  resetAt: "2026-10-16T13:00:00Z",
};

const userBody = (years: number[]) => ({
  data: {
    rateLimit,
    user: {
      login: "ada",
      name: "Ada",
      avatarUrl: "https://avatars.example/ada",
      createdAt: "2019-01-01T00:00:00Z",
      contributionsCollection: { contributionYears: years },
    },
  },
});

const yearBody = (commits: number) => ({
  data: {
    rateLimit,
    user: {
      year: {
        totalCommitContributions: commits,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        totalIssueContributions: 0,
        restrictedContributionsCount: 0,
        contributionCalendar: {
          totalContributions: commits,
          weeks: [
            {
              contributionDays: [
                { date: "2025-02-01", contributionCount: commits, weekday: 6 },
              ],
            },
          ],
        },
      },
      q1: {
        commitContributionsByRepository: [
          {
            repository: {
              nameWithOwner: "ada/engine",
              isPrivate: false,
              visibility: "PUBLIC",
            },
            contributions: {
              nodes: [
                { occurredAt: "2025-02-01T00:00:00Z", commitCount: commits },
              ],
            },
          },
        ],
      },
      q2: { commitContributionsByRepository: [] },
      q3: { commitContributionsByRepository: [] },
      q4: { commitContributionsByRepository: [] },
    },
  },
});

const reposBody = (hasNextPage = false) => ({
  data: {
    rateLimit,
    user: {
      repositories: {
        pageInfo: { hasNextPage, endCursor: hasNextPage ? "c" : null },
        nodes: [
          {
            name: "engine",
            createdAt: "2020-01-01T00:00:00Z",
            stargazerCount: 12,
            languages: { edges: [{ size: 10, node: { name: "Rust" } }] },
          },
        ],
      },
    },
  },
});

const rateLimited = {
  data: { rateLimit },
  errors: [{ type: "RATE_LIMITED" }],
};

type Handler = (kind: "Preview" | "Year" | "Repos") => unknown;

/** Routes fetch calls by the GraphQL operation name and counts them. */
function stubGithub(handler: Handler) {
  const calls = { Preview: 0, Year: 0, Repos: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const { query } = JSON.parse(String(init.body)) as { query: string };
      const kind = (["Preview", "Year", "Repos"] as const).find((k) =>
        query.includes(`query ${k}(`),
      ) as keyof typeof calls;
      calls[kind]++;
      return new Response(JSON.stringify(handler(kind)));
    }),
  );
  return calls;
}

function setup(overrides: Partial<ProfileDeps> = {}) {
  const { store, values } = createTestStore();
  const refund = vi.fn(async () => {});
  const charge = vi.fn(async () => ({ refund }));
  const deps: ProfileDeps = {
    chargeColdGeneration: charge,
    getToken: () => "token",
    cache: createCache(store, ""),
    breaker: createBreaker(store, ""),
    lock: createLock(store, ""),
    now: () => NOW,
    sleep: async () => {},
    ...overrides,
  };
  return { deps, values, charge, refund };
}

/** User with years 2025 and 2024; the current year (2026) is added by the service. */
const happyPath: Handler = (kind) =>
  kind === "Preview"
    ? userBody([2025, 2024])
    : kind === "Year"
      ? yearBody(3)
      : reposBody();

const loggedEvents = (info: { mock: { calls: unknown[][] } }) =>
  info.mock.calls.map((call) => JSON.parse(String(call[0])));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getProfile", () => {
  it("generates a cold profile, then serves it from cache", async () => {
    const calls = stubGithub(happyPath);
    const { deps, charge } = setup();

    const first = await getProfile("ada", visitor, deps);
    expect(first).toMatchObject({ status: "ok", source: "fresh" });
    if (first.status !== "ok") return;
    expect(first.profile.years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(first.profile.years[0]?.reconciliation.matches).toBe(true);
    expect(first.profile.repos[0]?.name).toBe("engine");
    expect(first.reposTruncated).toBe(false);
    expect(calls).toEqual({ Preview: 1, Year: 3, Repos: 1 });
    expect(charge).toHaveBeenCalledTimes(1);

    const second = await getProfile("ADA", visitor, deps);
    expect(second).toMatchObject({ status: "ok", source: "cache" });
    expect(calls).toEqual({ Preview: 1, Year: 3, Repos: 1 });
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it("returns login_required when the quota is exhausted, without calling GitHub", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup({ chargeColdGeneration: async () => null });
    expect(await getProfile("ada", visitor, deps)).toEqual({
      status: "login_required",
      reason: "quota_exhausted",
    });
    expect(calls).toEqual({ Preview: 0, Year: 0, Repos: 0 });
  });

  it("does not charge to complete a partially cached profile", async () => {
    const calls = stubGithub(happyPath);
    const { deps, charge, values } = setup();
    await getProfile("ada", visitor, deps);
    values.delete(deps.cache.key("year", "ada", 2024));
    values.delete(deps.cache.key("repos", "ada"));
    charge.mockClear();

    expect(await getProfile("ada", visitor, deps)).toMatchObject({
      status: "ok",
      source: "fresh",
    });
    expect(charge).not.toHaveBeenCalled();
    expect(calls.Year).toBe(4);
  });

  it("does not charge to refresh a stale current year even when the quota is spent", async () => {
    stubGithub(happyPath);
    const { deps } = setup();
    await getProfile("ada", visitor, deps);
    const tasks: (() => Promise<void>)[] = [];
    const exhausted: ProfileDeps = {
      ...deps,
      chargeColdGeneration: async () => null,
      now: () => new Date(NOW.getTime() + 7 * 60 * 60 * 1000),
      scheduleRefresh: (task) => tasks.push(task),
    };
    expect(await getProfile("ada", visitor, exhausted)).toMatchObject({
      status: "ok",
      source: "cache",
    });
    expect(tasks).toHaveLength(1);
  });

  it("refunds the charge when the generation fails", async () => {
    stubGithub((kind) => (kind === "Year" ? rateLimited : happyPath(kind)));
    const { deps, charge, refund } = setup();
    expect(await getProfile("ada", visitor, deps)).toMatchObject({
      status: "rate_limited",
    });
    expect(charge).toHaveBeenCalledTimes(1);
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("keeps the charge for unknown users so probing logins is not free", async () => {
    stubGithub(() => ({ data: { rateLimit, user: null } }));
    const ghost = setup();
    expect(await getProfile("ghost", visitor, ghost.deps)).toEqual({
      status: "not_found",
    });
    expect(ghost.charge).toHaveBeenCalledTimes(1);
    expect(ghost.refund).not.toHaveBeenCalled();

    stubGithub(happyPath);
    const ok = setup();
    await getProfile("ada", visitor, ok.deps);
    expect(ok.refund).not.toHaveBeenCalled();
  });

  it("charges the history of a user whose free preview is already cached", async () => {
    stubGithub(happyPath);
    const { deps, charge } = setup();
    await getPreview("ada", deps);
    expect(charge).not.toHaveBeenCalled();

    await getProfile("ada", visitor, deps);
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it("refunds the charge and rethrows when the generation throws", async () => {
    stubGithub(happyPath);
    const { deps, refund } = setup({
      getToken: () => {
        throw new Error("GITHUB_TOKEN is missing");
      },
    });
    await expect(getProfile("ada", visitor, deps)).rejects.toThrow(
      "GITHUB_TOKEN",
    );
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("does not charge while the breaker is open", async () => {
    stubGithub(happyPath);
    const { deps, charge } = setup();
    await deps.breaker.record({ ...rateLimit, remaining: 100 }, NOW);
    await getProfile("ada", visitor, deps);
    expect(charge).not.toHaveBeenCalled();
  });

  it("fails closed when the quota store is down", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup({
      chargeColdGeneration: async () => {
        throw new Error("redis down");
      },
    });
    expect(await getProfile("ada", visitor, deps)).toEqual({
      status: "degraded",
      reason: "store_down",
    });
    expect(calls.Preview).toBe(0);
  });

  it("fetches the current year when the cached years do not include it", async () => {
    const calls = stubGithub((kind) =>
      kind === "Preview" ? userBody([2025]) : happyPath(kind),
    );
    const result = await getProfile("ada", visitor, setup().deps);
    expect(result.status).toBe("ok");
    expect(calls.Year).toBe(2);
  });

  it("flags truncated repository lists", async () => {
    stubGithub((kind) =>
      kind === "Repos" ? reposBody(true) : happyPath(kind),
    );
    const result = await getProfile("ada", visitor, setup().deps);
    expect(result).toMatchObject({ status: "ok", reposTruncated: true });
  });

  it("serves only cache when the circuit breaker is open", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup();
    await deps.breaker.record({ ...rateLimit, remaining: 100 }, NOW);

    expect(await getProfile("ada", visitor, deps)).toEqual({
      status: "degraded",
      reason: "circuit_open",
    });
    expect(calls.Year).toBe(0);
  });

  it("negative-caches unknown users", async () => {
    const calls = stubGithub(() => ({ data: { rateLimit, user: null } }));
    const { deps } = setup();
    expect(await getProfile("ghost", visitor, deps)).toEqual({
      status: "not_found",
    });
    expect(await getProfile("ghost", visitor, deps)).toEqual({
      status: "not_found",
    });
    expect(calls.Preview).toBe(1);
  });

  it("keeps years that succeeded, opens the breaker and records a short failure marker", async () => {
    let yearCalls = 0;
    stubGithub((kind) => {
      if (kind === "Year") {
        yearCalls++;
        return yearCalls === 2 ? rateLimited : yearBody(3);
      }
      return happyPath(kind);
    });
    const { deps, values } = setup();
    const result = await getProfile("ada", visitor, deps);
    expect(result).toMatchObject({ status: "rate_limited" });
    expect(await deps.breaker.isOpen(NOW)).toBe(true);

    // Inside the cooldown a retry gets the recorded failure without calling GitHub.
    const calls = stubGithub(happyPath);
    expect(await getProfile("ada", visitor, deps)).toMatchObject({
      status: "rate_limited",
    });
    expect(calls.Year).toBe(0);

    // Once the cooldown and the rate limit window are over, only the missing year is paid for.
    values.delete(deps.cache.key("failed", "ada"));
    values.delete("v1:budget:server");
    expect(await getProfile("ada", visitor, deps)).toMatchObject({
      status: "ok",
    });
    expect(calls.Year).toBe(1);
  });

  it("stops launching years after the first rate limit", async () => {
    let yearCalls = 0;
    const calls = stubGithub((kind) => {
      if (kind === "Preview") {
        return userBody(Array.from({ length: 12 }, (_, i) => 2025 - i));
      }
      if (kind === "Year") return yearCalls++ === 0 ? rateLimited : yearBody(1);
      return reposBody();
    });
    const result = await getProfile("ada", visitor, setup().deps);
    expect(result).toMatchObject({ status: "rate_limited" });
    expect(calls.Year).toBeLessThanOrEqual(6);
    expect(calls.Repos).toBe(0);
  });

  it("maps the overall deadline to a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(
                Object.assign(new Error("aborted"), { name: "TimeoutError" }),
              ),
            );
          }),
      ),
    );
    const result = await getProfile(
      "ada",
      visitor,
      setup({ deadlineMs: 5, minBudgetMs: 0 }).deps,
    );
    expect(result).toEqual({ status: "timeout" });
    expect(GENERATION_DEADLINE_MS).toBeLessThan(60_000);
  });

  it("coalesces concurrent cold requests into a single fetch", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => getProfile("ada", visitor, deps)),
    );
    expect(results.every((r) => r.status === "ok")).toBe(true);
    expect(calls).toEqual({ Preview: 1, Year: 3, Repos: 1 });
  });

  it("makes waiters return the leader's failure instead of retrying", async () => {
    const calls = stubGithub((kind) =>
      kind === "Year" ? rateLimited : happyPath(kind),
    );
    const { deps } = setup();
    const results = await Promise.all(
      Array.from({ length: 4 }, () => getProfile("ada", visitor, deps)),
    );
    expect(results.every((r) => r.status === "rate_limited")).toBe(true);
    expect(calls.Year).toBe(3);
  });

  it("polls with jittered backoff and gives up with degraded/busy", async () => {
    stubGithub(happyPath);
    const { deps } = setup();
    await deps.lock.acquire("ada");
    let clock = NOW.getTime();
    const sleeps: number[] = [];
    const result = await getProfile("ada", visitor, {
      ...deps,
      random: () => 0.5,
      now: () => new Date(clock),
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += GENERATION_DEADLINE_MS / 4;
      },
    });
    expect(result).toEqual({ status: "degraded", reason: "busy" });
    expect(sleeps.length).toBeGreaterThan(1);
    for (const ms of sleeps) {
      expect(ms).toBeGreaterThanOrEqual(WAIT_MIN_MS);
      expect(ms).toBeLessThanOrEqual(WAIT_MAX_MS);
    }
  });

  it("fails closed with store_down when the lock or breaker cannot be reached", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup();
    const lockDown = {
      ...deps,
      lock: {
        acquire: async () => {
          throw new Error("redis down");
        },
      },
    };
    expect(await getProfile("ada", visitor, lockDown)).toEqual({
      status: "degraded",
      reason: "store_down",
    });

    const breakerDown = {
      ...deps,
      breaker: {
        ...deps.breaker,
        isOpen: async () => {
          throw new Error("redis down");
        },
      },
    };
    expect(await getProfile("ada", visitor, breakerDown)).toEqual({
      status: "degraded",
      reason: "store_down",
    });
    expect(calls).toEqual({ Preview: 0, Year: 0, Repos: 0 });
  });

  it("treats cache read errors as misses and never loses a good result to write or unlock errors", async () => {
    stubGithub(happyPath);
    const { deps } = setup();
    const broken: ProfileDeps = {
      ...deps,
      cache: {
        ...deps.cache,
        getUser: async () => {
          throw new Error("read failed");
        },
        setYear: async () => {
          throw new Error("write failed");
        },
        setRepos: async () => {
          throw new Error("write failed");
        },
      },
      lock: {
        acquire: async () => async () => {
          throw new Error("unlock failed");
        },
      },
    };
    const result = await getProfile("ada", visitor, broken);
    expect(result).toMatchObject({ status: "ok", source: "fresh" });
  });

  it("serves a stale current year and refreshes it after the response", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup();
    await getProfile("ada", visitor, deps);
    expect(calls.Year).toBe(3);

    const tasks: (() => Promise<void>)[] = [];
    const later = new Date(NOW.getTime() + 7 * 60 * 60 * 1000);
    const stale: ProfileDeps = {
      ...deps,
      now: () => later,
      scheduleRefresh: (task) => tasks.push(task),
    };
    expect(await getProfile("ada", visitor, stale)).toMatchObject({
      status: "ok",
      source: "cache",
    });
    expect(calls.Year).toBe(3);
    expect(tasks).toHaveLength(1);

    await tasks[0]?.();
    expect(calls.Year).toBe(4);

    // Fresh again: no further refresh is scheduled.
    await getProfile("ada", visitor, stale);
    expect(tasks).toHaveLength(1);
  });

  it("refetches a year that ended after it was cached, together with the new year", async () => {
    const calls = stubGithub((kind) =>
      kind === "Preview" ? userBody([2026, 2025, 2024]) : happyPath(kind),
    );
    const { deps } = setup({ now: () => new Date("2026-12-31T23:00:00Z") });
    await getProfile("ada", visitor, deps);
    expect(calls.Year).toBe(3);

    const newYear: ProfileDeps = {
      ...deps,
      now: () => new Date("2027-01-01T01:00:00Z"),
    };
    expect(await getProfile("ada", visitor, newYear)).toMatchObject({
      status: "ok",
      source: "fresh",
    });
    // 2027 is new and 2026 went stale; 2025 and 2024 stay cached.
    expect(calls.Year).toBe(5);
    expect(await getProfile("ada", visitor, newYear)).toMatchObject({
      source: "cache",
    });
    expect(calls.Year).toBe(5);
  });

  it("backs off from refreshes after a failed refresh", async () => {
    stubGithub(happyPath);
    const { deps } = setup();
    await getProfile("ada", visitor, deps);

    const tasks: (() => Promise<void>)[] = [];
    const stale: ProfileDeps = {
      ...deps,
      now: () => new Date(NOW.getTime() + 7 * 60 * 60 * 1000),
      scheduleRefresh: (task) => tasks.push(task),
    };
    await getProfile("ada", visitor, stale);
    expect(tasks).toHaveLength(1);

    stubGithub((kind) =>
      kind === "Year" ? { errors: [{ message: "boom" }] } : happyPath(kind),
    );
    await tasks[0]?.();

    // The failed refresh left a marker: stale data keeps being served quietly.
    expect(await getProfile("ada", visitor, stale)).toMatchObject({
      source: "cache",
    });
    expect(tasks).toHaveLength(1);
  });

  it("does not start a fetch when the lock is won with almost no budget left", async () => {
    const calls = stubGithub(happyPath);
    const { deps, values } = setup();
    const held = await deps.lock.acquire("ada");
    let clock = NOW.getTime();
    const result = await getProfile("ada", visitor, {
      ...deps,
      now: () => new Date(clock),
      sleep: async () => {
        clock += GENERATION_DEADLINE_MS - 2_000;
        await held?.();
      },
    });
    expect(result).toEqual({ status: "degraded", reason: "busy" });
    expect(calls).toEqual({ Preview: 0, Year: 0, Repos: 0 });
    expect(values.has(deps.cache.key("failed", "ada"))).toBe(false);
  });

  it("logs one structured line per generation with cost and remaining budget", async () => {
    stubGithub(happyPath);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await getProfile("Ada", visitor, setup().deps);
    const line = loggedEvents(info).find((l) => l.event === "generation");
    expect(line).toMatchObject({
      login: "ada",
      status: "ok",
      source: "fresh",
      years: 3,
      remaining: 4900,
      cost: 5,
    });
    expect(typeof line.ms).toBe("number");
  });
});

describe("getPreview", () => {
  it("answers degraded on a cache miss while the breaker is open, but serves cached previews", async () => {
    const calls = stubGithub(() => userBody([2025]));
    const { deps } = setup();
    await getPreview("ada", deps);
    await deps.breaker.record({ ...rateLimit, remaining: 100 }, NOW);

    expect(await getPreview("ada", deps)).toMatchObject({ status: "ok" });
    expect(await getPreview("bob", deps)).toEqual({
      status: "degraded",
      reason: "circuit_open",
    });
    expect(calls.Preview).toBe(1);
  });

  it("fetches once and then serves the cached preview", async () => {
    const calls = stubGithub(() => userBody([2025]));
    const { deps } = setup();
    expect(await getPreview("ada", deps)).toMatchObject({
      status: "ok",
      user: { login: "ada" },
    });
    await getPreview("ada", deps);
    expect(calls.Preview).toBe(1);
  });

  it("maps timeouts without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("gateway", { status: 502 })),
    );
    expect(await getPreview("ada", setup().deps)).toEqual({
      status: "timeout",
    });
  });
});

describe("getProfile for a signed-in visitor", () => {
  const USER_TOKEN = "gho_user_own_token_0000000000000000";
  type Kind = "Preview" | "Year" | "Repos";

  /** Like stubGithub, but a handler can answer any HTTP status, and bearer tokens are recorded. */
  function stubWithAuth(handler: (kind: Kind) => Response) {
    const bearers: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bearers.push(
          (init.headers as Record<string, string>).authorization ?? "",
        );
        const { query } = JSON.parse(String(init.body)) as { query: string };
        const kind = (["Preview", "Year", "Repos"] as const).find((k) =>
          query.includes(`query ${k}(`),
        ) as Kind;
        return handler(kind);
      }),
    );
    return bearers;
  }
  const ok = (body: unknown) => new Response(JSON.stringify(body));
  const happy = (kind: Kind) => ok(happyPath(kind));
  const unauthorized = () =>
    new Response(JSON.stringify({ message: "Bad credentials" }), {
      status: 401,
    });

  it("generates with their own token, skipping the anonymous quota and the server token", async () => {
    const bearers = stubWithAuth(happy);
    const getToken = vi.fn(() => "server-token");
    const chargeColdGeneration = vi.fn(async () => null);
    const { deps } = setup({ getToken, chargeColdGeneration });

    const result = await getProfile("ada", visitor, deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });

    expect(result).toMatchObject({ status: "ok", source: "fresh" });
    expect(chargeColdGeneration).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(bearers.length).toBeGreaterThan(0);
    expect(new Set(bearers)).toEqual(new Set([`bearer ${USER_TOKEN}`]));
  });

  it("keeps anonymous visitors gated: the quota still applies without a token", async () => {
    stubWithAuth(happy);
    const { deps } = setup({ chargeColdGeneration: async () => null });
    expect(await getProfile("ada", visitor, deps)).toEqual({
      status: "login_required",
      reason: "quota_exhausted",
    });
    expect(await getProfile("ada", visitor, deps, { userToken: null })).toEqual(
      { status: "login_required", reason: "quota_exhausted" },
    );
  });

  it("populates the shared cache for everyone", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup({ chargeColdGeneration: async () => null });
    await getProfile("ada", visitor, deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });
    const before = { ...calls };

    const anonymous = await getProfile("ada", visitor, deps);
    expect(anonymous).toMatchObject({ status: "ok", source: "cache" });
    expect(calls).toEqual(before);
  });

  it("still uses the coalescing lock", async () => {
    const calls = stubGithub(happyPath);
    const { deps } = setup();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        getProfile("ada", visitor, deps, {
          userToken: USER_TOKEN,
          viewerLogin: "viewer",
        }),
      ),
    );
    expect(results.every((r) => r.status === "ok")).toBe(true);
    expect(calls).toEqual({ Preview: 1, Year: 3, Repos: 1 });

    const busy = setup();
    await busy.deps.lock.acquire("grace");
    let clock = NOW.getTime();
    expect(
      await getProfile(
        "grace",
        visitor,
        {
          ...busy.deps,
          now: () => new Date(clock),
          sleep: async () => {
            clock += GENERATION_DEADLINE_MS;
          },
        },
        { userToken: USER_TOKEN, viewerLogin: "viewer" },
      ),
    ).toEqual({ status: "degraded", reason: "busy" });
  });

  it("is not stopped by an open circuit breaker, which only guards the server token", async () => {
    stubWithAuth(happy);
    const { deps } = setup();
    await deps.breaker.record({ ...rateLimit, remaining: 100 }, NOW);
    expect(await deps.breaker.isOpen(NOW)).toBe(true);

    expect(
      await getProfile("ada", visitor, deps, {
        userToken: USER_TOKEN,
        viewerLogin: "viewer",
      }),
    ).toMatchObject({ status: "ok", source: "fresh" });
    // The same request without a token is stopped.
    expect(await getProfile("grace", visitor, deps)).toEqual({
      status: "degraded",
      reason: "circuit_open",
    });
  });

  it("never lets their budget open the breaker, even when it is nearly spent or rate limited", async () => {
    const low = { ...rateLimit, remaining: 10 };
    stubWithAuth((kind) => {
      const body = happyPath(kind) as { data: object };
      return ok({ data: { ...body.data, rateLimit: low } });
    });
    const first = setup();
    await getProfile("ada", visitor, first.deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });
    expect(await first.deps.breaker.isOpen(NOW)).toBe(false);
    expect(first.values.has("v1:budget:server")).toBe(false);

    stubWithAuth((kind) => (kind === "Year" ? ok(rateLimited) : happy(kind)));
    const second = setup();
    const result = await getProfile("ada", visitor, second.deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });
    expect(result).toMatchObject({ status: "rate_limited" });
    expect(await second.deps.breaker.isOpen(NOW)).toBe(false);
  });

  it("does not record their rate limit as a failure served to everyone else", async () => {
    stubWithAuth((kind) => (kind === "Year" ? ok(rateLimited) : happy(kind)));
    const { deps } = setup();
    await getProfile("ada", visitor, deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });
    expect(await deps.cache.getFailure("ada")).toBeNull();
  });

  it("falls back to anonymous when GitHub rejects their token, and reports it once", async () => {
    const bearers: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const bearer = (init.headers as Record<string, string>).authorization;
        bearers.push(bearer ?? "");
        const { query } = JSON.parse(String(init.body)) as { query: string };
        const kind = (["Preview", "Year", "Repos"] as const).find((k) =>
          query.includes(`query ${k}(`),
        ) as Kind;
        return bearer === `bearer ${USER_TOKEN}` ? unauthorized() : happy(kind);
      }),
    );
    const onTokenRejected = vi.fn();
    const { deps, charge } = setup();

    const result = await getProfile("ada", visitor, deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
      onTokenRejected,
    });

    expect(result).toMatchObject({ status: "ok", source: "fresh" });
    expect(onTokenRejected).toHaveBeenCalledTimes(1);
    // The retry is anonymous: server token and quota.
    expect(bearers.at(-1)).toBe("bearer token");
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it("asks an exhausted anonymous visitor to sign in again after a rejected token", async () => {
    stubWithAuth(() => unauthorized());
    const onTokenRejected = vi.fn();
    const { deps } = setup({ chargeColdGeneration: async () => null });
    const result = await getProfile("ada", visitor, deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
      onTokenRejected,
    });
    expect(result).toEqual({
      status: "login_required",
      reason: "quota_exhausted",
    });
    expect(onTokenRejected).toHaveBeenCalledTimes(1);
  });

  it("does not poison shared state when a token is rejected", async () => {
    stubWithAuth(() => unauthorized());
    const { deps } = setup({ chargeColdGeneration: async () => null });
    await getProfile("ada", visitor, deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });
    expect(await deps.cache.getFailure("ada")).toBeNull();
    expect(await deps.cache.isMissing("ada")).toBe(false);
    expect(await deps.breaker.isOpen(NOW)).toBe(false);
  });

  it("reports a rejected server token as an upstream error, not as a visitor problem", async () => {
    stubWithAuth(() => unauthorized());
    const onTokenRejected = vi.fn();
    const result = await getProfile("ada", visitor, setup().deps, {
      onTokenRejected,
    });
    expect(result).toMatchObject({ status: "upstream_error" });
    expect(onTokenRejected).not.toHaveBeenCalled();
  });

  it("fetches their own profile with the server token, so owner-only data never enters the shared cache", async () => {
    for (const requested of ["ada", "Ada", "ADA"]) {
      const bearers = stubWithAuth(happy);
      const chargeColdGeneration = vi.fn(async () => null);
      const { deps } = setup({ chargeColdGeneration });
      const result = await getProfile(requested, visitor, deps, {
        userToken: USER_TOKEN,
        viewerLogin: "aDa",
      });
      expect(result).toMatchObject({ status: "ok", source: "fresh" });
      expect(bearers.length).toBeGreaterThan(0);
      expect(new Set(bearers)).toEqual(new Set(["bearer token"]));
      // Still skips the anonymous quota.
      expect(chargeColdGeneration).not.toHaveBeenCalled();
    }
  });

  it("keeps the breaker rules for their own profile, since the server token pays", async () => {
    stubWithAuth(happy);
    const { deps } = setup();
    await deps.breaker.record({ ...rateLimit, remaining: 100 }, NOW);
    expect(
      await getProfile("ada", visitor, deps, {
        userToken: USER_TOKEN,
        viewerLogin: "ada",
      }),
    ).toEqual({ status: "degraded", reason: "circuit_open" });
  });

  it("treats a session without a login as anonymous", async () => {
    const bearers = stubWithAuth(happy);
    const chargeColdGeneration = vi.fn(async () => null);
    const { deps } = setup({ chargeColdGeneration });
    expect(
      await getProfile("grace", visitor, deps, {
        userToken: USER_TOKEN,
        viewerLogin: null,
      }),
    ).toEqual({ status: "login_required", reason: "quota_exhausted" });
    expect(chargeColdGeneration).toHaveBeenCalledTimes(1);
    expect(bearers).toEqual([]);
  });

  it("does not record any failure of their token for everyone else", async () => {
    stubWithAuth((kind) =>
      kind === "Year"
        ? new Response(JSON.stringify({ message: "boom" }), { status: 500 })
        : happy(kind),
    );
    const { deps } = setup();
    const result = await getProfile("grace", visitor, deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });
    expect(result).toMatchObject({ status: "upstream_error" });
    expect(await deps.cache.getFailure("grace")).toBeNull();
  });

  it("never logs the token", async () => {
    stubWithAuth(happy);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await getProfile("ada", visitor, setup().deps, {
      userToken: USER_TOKEN,
      viewerLogin: "viewer",
    });
    expect(
      info.mock.calls.map((call) => String(call[0])).join("\n"),
    ).not.toContain(USER_TOKEN);
    expect(loggedEvents(info).at(-1)).toMatchObject({ auth: "user" });
  });
});
