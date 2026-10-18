import { describe, expect, it } from "vitest";
import { buildHistory } from "./history";
import type { ProfileData } from "./types";
import { buildYearSummary } from "./year-summary";

const year = (y: number, commits: number, priv: number) =>
  buildYearSummary({
    year: y,
    totals: {
      commits,
      pullRequests: 1,
      reviews: 0,
      issues: 0,
      privateContributions: priv,
    },
    commitContributionsByRepo: [
      [{ occurredAt: `${y}-12-31T00:00:00Z`, commitCount: commits }],
    ],
    publicRepoContributions: [
      {
        repo: "ada/engine",
        nodes: [{ occurredAt: `${y}-12-31T00:00:00Z`, commitCount: commits }],
      },
    ],
    calendar: [{ date: `${y}-12-31`, count: commits, weekday: 1 }],
    totalContributions: commits + priv,
  });

describe("buildHistory", () => {
  const profile: ProfileData = {
    user: {
      login: "ada",
      name: "Ada",
      avatarUrl: "a",
      createdAt: "2019-01-01T00:00:00Z",
      contributionYears: [2023, 2022],
    },
    years: [year(2022, 4, 2), year(2023, 6, 1)],
    repos: [
      {
        name: "first",
        createdAt: "2019-02-01T00:00:00Z",
        stars: 0,
        languages: [{ name: "Go", size: 10 }],
      },
    ],
  };

  it("composes totals, blocks and metrics without leaking raw calendars", () => {
    const history = buildHistory(profile);
    expect(history.totals).toEqual({
      commits: 10,
      pullRequests: 2,
      reviews: 0,
      issues: 0,
      privateContributions: 3,
    });
    expect(history.yearBlocks).toEqual([
      { year: 2022, contributions: 6 },
      { year: 2023, contributions: 7 },
    ]);
    expect(history.totalContributions).toBe(13);
    expect(history.years[0]?.totalContributions).toBe(6);
    expect(history.years[0]?.dailyContributions).toEqual([
      { date: "2022-12-31", count: 4 },
    ]);
    expect(history.years[0]?.heatmap[0]?.contributions).toBe(4);
    expect(history.years[0]).not.toHaveProperty("calendar");
    expect(history.languages[0]?.name).toBe("Go");
    expect(history.repoFlags[0]?.reason).toBe("first");
    // 2022-12-31 and 2023-12-31 are not consecutive days.
    expect(history.longestStreak.length).toBe(1);
  });

  it("exposes the calendar for a profile with only private contributions", () => {
    const history = buildHistory({
      ...profile,
      years: [
        buildYearSummary({
          year: 2026,
          totals: {
            commits: 0,
            pullRequests: 0,
            reviews: 0,
            issues: 0,
            privateContributions: 1912,
          },
          commitContributionsByRepo: [],
          publicRepoContributions: [],
          calendar: [
            { date: "2026-03-02", count: 900, weekday: 1 },
            { date: "2026-03-03", count: 1012, weekday: 2 },
            { date: "2026-03-04", count: 0, weekday: 3 },
          ],
          totalContributions: 1912,
        }),
      ],
    });
    const [only] = history.years;
    expect(only?.dailyContributions).toEqual([
      { date: "2026-03-02", count: 900 },
      { date: "2026-03-03", count: 1012 },
    ]);
    expect(only?.totalContributions).toBe(1912);
    expect(only?.dailyCommits).toEqual([]);
    expect(history.totals.commits).toBe(0);
    expect(history.totals.privateContributions).toBe(1912);
    expect(history.totalContributions).toBe(1912);
  });

  it("handles a profile without contribution years", () => {
    const history = buildHistory({
      user: { ...profile.user, contributionYears: [] },
      years: [],
      repos: [],
    });
    expect(history.years).toEqual([]);
    expect(history.yearBlocks).toEqual([]);
    expect(history.totals.commits).toBe(0);
    expect(history.totalContributions).toBe(0);
    expect(history.longestStreak).toEqual({
      length: 0,
      start: null,
      end: null,
    });
    expect(history.languages).toEqual([]);
    expect(history.repoFlags).toEqual([]);
  });

  it("computes the streak across adjacent years sharing a boundary day", () => {
    const calendarYear = (y: number, days: [string, number, number][]) =>
      buildYearSummary({
        year: y,
        totals: {
          commits: 0,
          pullRequests: 0,
          reviews: 0,
          issues: 0,
          privateContributions: 0,
        },
        commitContributionsByRepo: [],
        publicRepoContributions: [],
        calendar: days.map(([date, count, weekday]) => ({
          date,
          count,
          weekday,
        })),
        totalContributions: days.reduce((sum, [, count]) => sum + count, 0),
      });
    const history = buildHistory({
      ...profile,
      years: [
        calendarYear(2022, [
          ["2022-12-30", 1, 5],
          ["2022-12-31", 1, 6],
        ]),
        calendarYear(2023, [
          ["2022-12-31", 1, 6],
          ["2023-01-01", 1, 0],
        ]),
      ],
    });
    expect(history.longestStreak).toEqual({
      length: 3,
      start: "2022-12-30",
      end: "2023-01-01",
    });
  });
});
