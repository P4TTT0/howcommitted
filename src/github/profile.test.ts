import { afterEach, describe, expect, it, vi } from "vitest";
import { createBreaker } from "./breaker";
import { createCache } from "./cache";
import { createLock } from "./lock";
import { createMemoryStore } from "./memory-store";
import { getPreview, getProfile, type ProfileDeps } from "./profile";

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
      contributionsCollection: {
        totalCommitContributions: commits,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        totalIssueContributions: 0,
        restrictedContributionsCount: 0,
        commitContributionsByRepository: [
          {
            contributions: {
              nodes: [
                { occurredAt: "2025-02-01T00:00:00Z", commitCount: commits },
              ],
            },
          },
        ],
        contributionCalendar: {
          weeks: [
            {
              contributionDays: [
                { date: "2025-02-01", contributionCount: commits, weekday: 6 },
              ],
            },
          ],
        },
      },
    },
  },
});

const reposBody = {
  data: {
    rateLimit,
    user: {
      repositories: {
        pageInfo: { hasNextPage: false, endCursor: null },
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
  const { store } = createMemoryStore();
  const deps: ProfileDeps = {
    getToken: () => "token",
    cache: createCache(store, ""),
    breaker: createBreaker(store, ""),
    lock: createLock(store, ""),
    consumeColdGeneration: vi.fn(async () => true),
    now: () => NOW,
    sleep: async () => {},
    ...overrides,
  };
  return deps;
}

const happyPath: Handler = (kind) =>
  kind === "Preview"
    ? userBody([2025, 2024])
    : kind === "Year"
      ? yearBody(3)
      : reposBody;

afterEach(() => vi.unstubAllGlobals());

describe("getProfile", () => {
  it("generates a cold profile, then serves it from cache without quota", async () => {
    const calls = stubGithub(happyPath);
    const deps = setup();

    const first = await getProfile("ada", visitor, deps);
    expect(first).toMatchObject({ status: "ok", source: "fresh" });
    if (first.status !== "ok") return;
    expect(first.profile.years.map((y) => y.year)).toEqual([2024, 2025]);
    expect(first.profile.years[0]?.reconciliation.matches).toBe(true);
    expect(first.profile.repos[0]?.name).toBe("engine");
    expect(calls).toEqual({ Preview: 1, Year: 2, Repos: 1 });
    expect(deps.consumeColdGeneration).toHaveBeenCalledTimes(1);

    const second = await getProfile("ADA", visitor, deps);
    expect(second).toMatchObject({ status: "ok", source: "cache" });
    expect(calls).toEqual({ Preview: 1, Year: 2, Repos: 1 });
    expect(deps.consumeColdGeneration).toHaveBeenCalledTimes(1);
  });

  it("returns login_required when the cold quota is exhausted, without calling GitHub", async () => {
    const calls = stubGithub(happyPath);
    const deps = setup({ consumeColdGeneration: vi.fn(async () => false) });
    expect(await getProfile("ada", visitor, deps)).toEqual({
      status: "login_required",
      reason: "quota_exhausted",
    });
    expect(calls).toEqual({ Preview: 0, Year: 0, Repos: 0 });
  });

  it("serves only cache when the circuit breaker is open", async () => {
    const calls = stubGithub(happyPath);
    const deps = setup();
    await deps.breaker.record({ ...rateLimit, remaining: 100 });
    const quota = deps.consumeColdGeneration as ReturnType<typeof vi.fn>;

    expect(await getProfile("ada", visitor, deps)).toEqual({
      status: "degraded",
      reason: "circuit_open",
    });
    expect(calls.Year).toBe(0);
    expect(quota).not.toHaveBeenCalled();
  });

  it("negative-caches unknown users", async () => {
    const calls = stubGithub(() => ({ data: { rateLimit, user: null } }));
    const deps = setup();
    expect(await getProfile("ghost", visitor, deps)).toEqual({
      status: "not_found",
    });
    expect(await getProfile("ghost", visitor, deps)).toEqual({
      status: "not_found",
    });
    expect(calls.Preview).toBe(1);
  });

  it("maps GitHub rate limiting and keeps years that already succeeded", async () => {
    let yearCalls = 0;
    stubGithub((kind) => {
      if (kind === "Preview") return userBody([2025, 2024]);
      if (kind === "Year") {
        yearCalls++;
        if (yearCalls === 2) {
          return { data: { rateLimit }, errors: [{ type: "RATE_LIMITED" }] };
        }
        return yearBody(3);
      }
      return reposBody;
    });
    const deps = setup();
    const result = await getProfile("ada", visitor, deps);
    expect(result).toMatchObject({ status: "rate_limited" });

    // A retry only fetches the missing year plus repos.
    const calls = stubGithub(happyPath);
    expect(await getProfile("ada", visitor, deps)).toMatchObject({
      status: "ok",
    });
    expect(calls.Year).toBe(1);
  });

  it("coalesces concurrent cold requests into a single fetch", async () => {
    const calls = stubGithub(happyPath);
    const deps = setup();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => getProfile("ada", visitor, deps)),
    );
    expect(results.every((r) => r.status === "ok")).toBe(true);
    expect(calls).toEqual({ Preview: 1, Year: 2, Repos: 1 });
    expect(deps.consumeColdGeneration).toHaveBeenCalledTimes(1);
  });

  it("gives up with degraded/busy when the lock holder never finishes", async () => {
    stubGithub(happyPath);
    const deps = setup();
    await deps.lock.acquire("ada");
    let clock = NOW.getTime();
    const result = await getProfile("ada", visitor, {
      ...deps,
      now: () => new Date(clock),
      sleep: async (ms) => {
        clock += ms * 10;
      },
    });
    expect(result).toEqual({ status: "degraded", reason: "busy" });
  });
});

describe("getPreview", () => {
  it("fetches once and then serves the cached preview", async () => {
    const calls = stubGithub(() => userBody([2025]));
    const deps = setup();
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
    expect(await getPreview("ada", setup())).toEqual({ status: "timeout" });
  });
});
