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

  it("keeps the official total next to the calendar total", () => {
    const summary = buildYearSummary({
      year: 2023,
      totals: totals(10),
      publicRepoContributions: [],
      calendar: [],
      totalContributions: 25,
    });
    expect(summary.totalContributions).toBe(25);
    expect(summary.totals.commits).toBe(10);
    expect(summary.totals.privateContributions).toBe(4);
  });

  it("orders year blocks oldest first", () => {
    const make = (year: number, commits: number) =>
      buildYearSummary({
        year,
        totals: totals(commits),
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
  it("drops empty repos, adds a repeated repo and sorts by name", () => {
    expect(
      mergeRepoCommits([
        { repo: "b/two", commits: 2 },
        { repo: "a/one", commits: 1 },
        { repo: "b/two", commits: 3 },
        { repo: "c/none", commits: 0 },
      ]),
    ).toEqual([
      { repo: "a/one", commits: 1 },
      { repo: "b/two", commits: 5 },
    ]);
  });
});
