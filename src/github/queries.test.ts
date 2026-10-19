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
  const totals = (commits: number) => ({
    totalCommitContributions: commits,
    totalPullRequestContributions: 2,
    totalPullRequestReviewContributions: 1,
    totalIssueContributions: 3,
    restrictedContributionsCount: 9,
    contributionCalendar: {
      totalContributions: 11,
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
  const repo = (
    totalCount: number,
    repository: unknown = {
      nameWithOwner: "a/engine",
      isPrivate: false,
      visibility: "PUBLIC",
    },
  ) => ({ repository, contributions: { totalCount } });
  const bodyOf = (commits: number, repos: unknown[]) => ({
    data: {
      rateLimit,
      user: {
        year: { ...totals(commits), commitContributionsByRepository: repos },
      },
    },
  });
  const yearBody = bodyOf(6, [
    repo(5),
    repo(1, {
      nameWithOwner: "b/tool",
      isPrivate: false,
      visibility: "PUBLIC",
    }),
  ]);

  it("maps totals, per-repo commits and the calendar", async () => {
    const fetchMock = stubFetchSequence(yearBody);
    const result = await fetchYear("t", "a", 2023);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totals).toEqual({
      commits: 6,
      pullRequests: 2,
      reviews: 1,
      issues: 3,
      privateContributions: 9,
    });
    expect(result.data.repoCommits).toEqual([
      { repo: "a/engine", commits: 5 },
      { repo: "b/tool", commits: 1 },
    ]);
    expect(result.data.calendar).toHaveLength(2);
    expect(result.data.totalContributions).toBe(11);
    expect(sentVariables(fetchMock, 0)).toEqual({
      login: "a",
      from: "2023-01-01T00:00:00Z",
      to: "2023-12-31T23:59:59Z",
    });
  });

  it("drops calendar days outside the requested year", async () => {
    const padded = structuredClone(yearBody);
    const calendar = padded.data.user.year.contributionCalendar;
    calendar.weeks[0]?.contributionDays.unshift({
      date: "2022-12-31",
      contributionCount: 3,
      weekday: 6,
    });
    calendar.weeks[0]?.contributionDays.push({
      date: "2024-01-01",
      contributionCount: 2,
      weekday: 1,
    });
    stubFetchSequence(padded);
    const result = await fetchYear("t", "a", 2023);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.calendar.map((day) => day.date)).toEqual([
      "2023-05-01",
      "2023-05-02",
    ]);
    // In-year days still add up to the calendar total: no false step.
    const sum = result.data.calendar.reduce(
      (total, day) => total + day.count,
      0,
    );
    expect(sum).toBe(result.data.totalContributions);
  });

  it("asks for one full-year window with per-repo totals and no day nodes", async () => {
    const fetchMock = stubFetchSequence(yearBody);
    await fetchYear("t", "a", 2023);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const query = String(JSON.parse(String(init.body)).query);
    expect(query).toContain(
      "year: contributionsCollection(from: $from, to: $to)",
    );
    expect(query.match(/contributionsCollection\(/g)).toHaveLength(1);
    expect(query).toContain(
      "commitContributionsByRepository(maxRepositories: 100)",
    );
    expect(query).toContain("contributions { totalCount }");
    expect(query).not.toMatch(/occurredAt|commitCount|nodes/);
    expect(query.match(/contributionCalendar/g)).toHaveLength(1);
  });

  it("drops private repositories", async () => {
    stubFetchSequence(
      bodyOf(9, [
        repo(5),
        repo(4, {
          nameWithOwner: "a/secret",
          isPrivate: true,
          visibility: "PRIVATE",
        }),
      ]),
    );
    const result = await fetchYear("t", "a", 2023);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.repoCommits).toEqual([{ repo: "a/engine", commits: 5 }]);
    expect(JSON.stringify(result.data)).not.toContain("secret");
    // Private commits still count toward the official yearly total.
    expect(result.data.totals.commits).toBe(9);
  });

  it("fails closed: drops repos with missing, null or non-public visibility", async () => {
    const hidden = [
      { nameWithOwner: "a/no-flag", visibility: "PUBLIC" },
      { nameWithOwner: "a/internal", isPrivate: false, visibility: "INTERNAL" },
      { nameWithOwner: "a/no-visibility", isPrivate: false },
      null,
    ];
    stubFetchSequence(
      bodyOf(5, [repo(1), ...hidden.map((repository) => repo(1, repository))]),
    );
    const result = await fetchYear("t", "a", 2023);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.repoCommits).toEqual([{ repo: "a/engine", commits: 1 }]);
    const json = JSON.stringify(result.data);
    for (const name of ["no-flag", "internal", "no-visibility"])
      expect(json).not.toContain(name);
  });

  it("returns not_found when the user is null", async () => {
    stubFetchSequence({ data: { rateLimit, user: null } });
    expect(await fetchYear("t", "ghost", 2023)).toMatchObject({
      ok: false,
      error: { kind: "not_found" },
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

  it("asks for public repositories only, so private names never reach the shared cache", async () => {
    const fetchMock = stubFetchSequence({
      data: {
        rateLimit,
        user: {
          repositories: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [node("a")],
          },
        },
      },
    });
    await fetchRepos("t", "a");
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    const { query } = JSON.parse(String(init.body)) as { query: string };
    expect(query).toContain("privacy: PUBLIC");
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
