import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchRepos,
  fetchUserPreview,
  fetchYear,
  MAX_REPO_PAGES,
} from "./queries";

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
  const yearBody = {
    data: {
      rateLimit,
      user: {
        contributionsCollection: {
          totalCommitContributions: 6,
          totalPullRequestContributions: 2,
          totalPullRequestReviewContributions: 1,
          totalIssueContributions: 3,
          restrictedContributionsCount: 9,
          commitContributionsByRepository: [
            {
              contributions: {
                nodes: [
                  { occurredAt: "2023-05-01T00:00:00Z", commitCount: 2 },
                  { occurredAt: "2023-05-02T00:00:00Z", commitCount: 1 },
                ],
              },
            },
            {
              contributions: {
                nodes: [{ occurredAt: "2023-05-01T00:00:00Z", commitCount: 3 }],
              },
            },
          ],
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
        },
      },
    },
  };

  it("sums daily commits, reconciles with the official total and keeps the calendar", async () => {
    const fetchMock = stubFetchSequence(yearBody);
    const result = await fetchYear("t", "a", 2023);
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
    });
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
