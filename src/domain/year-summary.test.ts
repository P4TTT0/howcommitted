import { describe, expect, it } from "vitest";
import type { YearTotals } from "./types";
import { buildYearSummary, yearBlocks } from "./year-summary";

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
      calendar: [],
    });
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
        calendar: [],
      });
    expect(yearBlocks([make(2024, 5), make(2022, 9)])).toEqual([
      { year: 2022, commits: 9 },
      { year: 2024, commits: 5 },
    ]);
  });
});
