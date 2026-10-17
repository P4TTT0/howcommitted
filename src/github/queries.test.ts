import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildYearQuery,
  fetchRepos,
  fetchUserPreview,
  fetchYear,
  MAX_REPO_PAGES,
} from "./queries";

const NOW = new Date("2026-10-16T12:00:00Z");

const rateLimit = {
  cost: 1,
  remaining: 4990,
  limit: 5000,
  resetAt: "2026-10-16T12:00:00Z",
};

function stubFetchSequence(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body)));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sentVariables = (fetchMock: ReturnType<typeof vi.fn>, call: number) => {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit;
  return JSON.parse(String(init.body)).variables;
};

afterEach(() => vi.unstubAllGlobals());

describe("fetchUserPreview", () => {
  it("maps the user and contribution years", async () => {
    stubFetchSequence({
      data: {
        rateLimit,
        user: {
          login: "torvalds",
          name: "Linus Torvalds",
          avatarUrl: "https://avatars.example/1",
          createdAt: "2011-09-03T15:26:22Z",
          contributionsCollection: { contributionYears: [2025, 2024] },
        },
      },
    });
    const result = await fetchUserPreview("t", "torvalds");
    expect(result).toEqual({
      ok: true,
      rateLimit,
      data: {
        login: "torvalds",
        name: "Linus Torvalds",
        avatarUrl: "https://avatars.example/1",
        createdAt: "2011-09-03T15:26:22Z",
        contributionYears: [2025, 2024],
      },
    });
  });

  it("returns not_found when the user is null", async () => {
    stubFetchSequence({ data: { rateLimit, user: null } });
    expect(await fetchUserPreview("t", "ghost")).toMatchObject({
      ok: false,
      error: { kind: "not_found" },
    });
  });
});

describe("fetchYear", () => {
  const empty = { commitContributionsByRepository: [] };
  const totals = (commits: number) => ({
    totalCommitContributions: commits,
    totalPullRequestContributions: 2,
    totalPullRequestReviewContributions: 1,
    totalIssueContributions: 3,
    restrictedContributionsCount: 9,
    contributionCalendar: {
      weeks: [
        {
          contributionDays: [
            { date: "2023-05-01", contributionCount: 7, weekday: 1 },
            { date: "2023-05-02", contributionCount: 4, weekday: 2 },
          ],
        },
      ],
    },
  });
  const repo = (nodes: { occurredAt: string; commitCount: number }[]) => ({
    contributions: { nodes },
  });
  const yearBody = {
    data: {
      rateLimit,
      user: {
        year: totals(6),
        q1: empty,
        q2: {
          commitContributionsByRepository: [
            repo([
              { occurredAt: "2023-05-01T00:00:00Z", commitCount: 2 },
              { occurredAt: "2023-05-02T00:00:00Z", commitCount: 1 },
            ]),
            repo([{ occurredAt: "2023-05-01T00:00:00Z", commitCount: 3 }]),
          ],
        },
        q3: empty,
        q4: empty,
      },
    },
  };

  it("sums daily commits, reconciles with the official total and keeps the calendar", async () => {
    const fetchMock = stubFetchSequence(yearBody);
    const result = await fetchYear("t", "a", 2023, undefined, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.dailyCommits).toEqual([
      { date: "2023-05-01", commits: 5 },
      { date: "2023-05-02", commits: 1 },
    ]);
    expect(result.data.reconciliation).toEqual({
      summed: 6,
      official: 6,
      difference: 0,
      matches: true,
    });
    expect(result.data.totals.privateContributions).toBe(9);
    expect(result.data.calendar).toHaveLength(2);
    expect(sentVariables(fetchMock, 0)).toEqual({
      login: "a",
      from: "2023-01-01T00:00:00Z",
      to: "2023-12-31T23:59:59Z",
      q1From: "2023-01-01T00:00:00Z",
      q1To: "2023-03-31T23:59:59Z",
      q2From: "2023-04-01T00:00:00Z",
      q2To: "2023-06-30T23:59:59Z",
      q3From: "2023-07-01T00:00:00Z",
      q3To: "2023-09-30T23:59:59Z",
      q4From: "2023-10-01T00:00:00Z",
      q4To: "2023-12-31T23:59:59Z",
    });
  });

  it("requests one full-year window and four quarter windows in one query", async () => {
    const fetchMock = stubFetchSequence(yearBody);
    await fetchYear("t", "a", 2023, undefined, NOW);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const query = String(JSON.parse(String(init.body)).query);
    expect(query).toContain(
      "year: contributionsCollection(from: $from, to: $to)",
    );
    for (const q of ["q1", "q2", "q3", "q4"]) {
      expect(query).toContain(
        `${q}: contributionsCollection(from: $${q}From, to: $${q}To)`,
      );
    }
    expect(query.match(/commitContributionsByRepository/g)).toHaveLength(4);
    expect(query.match(/contributionCalendar/g)).toHaveLength(1);
  });

  it("counts a repo with 150 commit days spread over the year (beyond the 100-node cap)", async () => {
    // 150 distinct days: 50 each in Q1..Q3. A single window would cap at 100.
    const days = (startMonth: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        occurredAt: new Date(Date.UTC(2023, startMonth, 1 + i)).toISOString(),
        commitCount: 2,
      }));
    stubFetchSequence({
      data: {
        rateLimit,
        user: {
          year: totals(300),
          q1: { commitContributionsByRepository: [repo(days(0, 50))] },
          q2: { commitContributionsByRepository: [repo(days(3, 50))] },
          q3: { commitContributionsByRepository: [repo(days(6, 50))] },
          q4: empty,
        },
      },
    });
    const result = await fetchYear("t", "a", 2023, undefined, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.dailyCommits).toHaveLength(150);
    expect(result.data.reconciliation).toEqual({
      summed: 300,
      official: 300,
      difference: 0,
      matches: true,
    });
  });

  it("skips quarters that have not started yet in the current year", async () => {
    const fetchMock = stubFetchSequence({
      data: {
        rateLimit,
        user: { year: totals(0), q1: empty, q2: empty, q3: empty },
      },
    });
    const result = await fetchYear(
      "t",
      "a",
      2026,
      undefined,
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(result.ok).toBe(true);
    const vars = sentVariables(fetchMock, 0);
    expect(vars.q3From).toBe("2026-07-01T00:00:00Z");
    expect(vars.q4From).toBeUndefined();
  });
  it("tolerates a null quarter and a repo with null nodes", async () => {
    stubFetchSequence({
      data: {
        rateLimit,
        user: {
          year: totals(3),
          q1: {
            commitContributionsByRepository: [
              repo([{ occurredAt: "2023-02-01T00:00:00Z", commitCount: 3 }]),
            ],
          },
          q2: null,
          q3: {
            commitContributionsByRepository: [
              { contributions: { nodes: null } },
            ],
          },
          q4: empty,
        },
      },
    });
    const result = await fetchYear("t", "a", 2023, undefined, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.dailyCommits).toEqual([
      { date: "2023-02-01", commits: 3 },
    ]);
    expect(result.data.reconciliation.matches).toBe(true);
  });

  it("includes only the quarters that have started at the boundaries", async () => {
    const sent = async (now: string) => {
      const fetchMock = stubFetchSequence({
        data: { rateLimit, user: { year: totals(0) } },
      });
      await fetchYear("t", "a", 2026, undefined, new Date(now));
      return sentVariables(fetchMock, 0);
    };
    expect(Object.keys(await sent("2025-12-31T23:59:59Z")).sort()).toEqual([
      "from",
      "login",
      "to",
    ]);
    expect((await sent("2026-07-01T00:00:00Z")).q3From).toBe(
      "2026-07-01T00:00:00Z",
    );
    const q1Only = await sent("2026-02-15T00:00:00Z");
    expect(q1Only.q1From).toBeDefined();
    expect(q1Only.q2From).toBeUndefined();
  });

  it("declares exactly the variables used by the quarter aliases for N=0..4", () => {
    for (let n = 0; n <= 4; n++) {
      const query = buildYearQuery(n);
      for (let q = 1; q <= 4; q++) {
        const present = q <= n;
        expect(query.includes(`$q${q}From: DateTime!`)).toBe(present);
        expect(query.includes(`$q${q}To: DateTime!`)).toBe(present);
        expect(query.includes(`q${q}: contributionsCollection(`)).toBe(present);
      }
      expect(query).toContain("year: contributionsCollection(");
    }
  });
});

describe("fetchRepos", () => {
  const node = (name: string) => ({
    name,
    createdAt: "2020-01-01T00:00:00Z",
    stargazerCount: 3,
    languages: { edges: [{ size: 100, node: { name: "TypeScript" } }] },
  });

  it("follows pagination and maps languages", async () => {
    const fetchMock = stubFetchSequence(
      {
        data: {
          rateLimit,
          user: {
            repositories: {
              pageInfo: { hasNextPage: true, endCursor: "c1" },
              nodes: [node("a")],
            },
          },
        },
      },
      {
        data: {
          rateLimit,
          user: {
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [node("b"), null],
            },
          },
        },
      },
    );
    const result = await fetchRepos("t", "a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.truncated).toBe(false);
    expect(result.data.repos.map((r) => r.name)).toEqual(["a", "b"]);
    expect(result.data.repos[0]).toEqual({
      name: "a",
      createdAt: "2020-01-01T00:00:00Z",
      stars: 3,
      languages: [{ name: "TypeScript", size: 100 }],
    });
    expect(sentVariables(fetchMock, 1)).toEqual({ login: "a", after: "c1" });
  });

  it("flags truncation when the page cap is hit with more repos left", async () => {
    const page = {
      data: {
        rateLimit,
        user: {
          repositories: {
            pageInfo: { hasNextPage: true, endCursor: "next" },
            nodes: [node("a")],
          },
        },
      },
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(page)));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchRepos("t", "a");
    expect(fetchMock).toHaveBeenCalledTimes(MAX_REPO_PAGES);
    expect(result.ok && result.data.truncated).toBe(true);
  });
});
