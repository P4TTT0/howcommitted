import { describe, expect, it } from "vitest";
import type { YearTotals } from "./types";
import {
  buildYearSummary,
  mergeRepoCommits,
  yearBlocks,
  yearBlocksInRange,
} from "./year-summary";

describe("buildYearSummary and yearBlocks", () => {
  const totals = (commits: number): YearTotals => ({
    commits,
    pullRequests: 0,
    reviews: 0,
    issues: 0,
    privateContributions: 4,
  });

  it("keeps the official total and reports reconciliation", () => {
    const summary = buildYearSummary({
      year: 2023,
      totals: totals(10),
      commitContributionsByRepo: [
        [{ occurredAt: "2023-03-01T00:00:00Z", commitCount: 7 }],
      ],
      publicRepoContributions: [],
      calendar: [],
      totalContributions: 25,
    });
    expect(summary.totalContributions).toBe(25);
    expect(summary.totals.commits).toBe(10);
    expect(summary.reconciliation.matches).toBe(false);
    expect(summary.reconciliation.summed).toBe(7);
    expect(summary.totals.privateContributions).toBe(4);
  });

  it("orders year blocks oldest first", () => {
    const make = (year: number, commits: number) =>
      buildYearSummary({
        year,
        totals: totals(commits),
        commitContributionsByRepo: [],
        publicRepoContributions: [],
        calendar: [],
        totalContributions: commits * 10,
      });
    expect(yearBlocks([make(2024, 5), make(2022, 9)])).toEqual([
      { year: 2022, contributions: 90 },
      { year: 2024, contributions: 50 },
    ]);
  });
});

describe("yearBlocksInRange", () => {
  it("fills missing years with explicit zeros", () => {
    expect(
      yearBlocksInRange(
        [
          { year: 2022, contributions: 9 },
          { year: 2024, contributions: 5 },
        ],
        2022,
        2025,
      ),
    ).toEqual([
      { year: 2022, contributions: 9 },
      { year: 2023, contributions: 0 },
      { year: 2024, contributions: 5 },
      { year: 2025, contributions: 0 },
    ]);
  });

  it("is empty for an inverted range", () => {
    expect(yearBlocksInRange([], 2024, 2022)).toEqual([]);
  });
});

describe("mergeRepoCommits", () => {
  it("adds commits and days of a repo across quarter windows", () => {
    expect(
      mergeRepoCommits([
        {
          repo: "b/two",
          nodes: [
            { occurredAt: "2023-01-05T00:00:00Z", commitCount: 2 },
            { occurredAt: "2023-01-06T00:00:00Z", commitCount: 0 },
          ],
        },
        {
          repo: "a/one",
          nodes: [{ occurredAt: "2023-02-01T00:00:00Z", commitCount: 1 }],
        },
        {
          repo: "b/two",
          nodes: [{ occurredAt: "2023-04-02T00:00:00Z", commitCount: 3 }],
        },
        { repo: "c/none", nodes: [] },
      ]),
    ).toEqual([
      { repo: "a/one", commits: 1, days: 1 },
      { repo: "b/two", commits: 5, days: 2 },
    ]);
  });
});
