import { describe, expect, it } from "vitest";
import { roleMix } from "./role-mix";
import type { YearTotals } from "./types";

const totals = (
  commits: number,
  pullRequests: number,
  reviews: number,
  issues: number,
): YearTotals => ({
  commits,
  pullRequests,
  reviews,
  issues,
  privateContributions: 99,
});

describe("roleMix", () => {
  it("is empty without years", () => {
    expect(roleMix([])).toEqual([]);
  });

  it("shares the four roles per year, oldest first, ignoring private counts", () => {
    expect(
      roleMix([
        { year: 2024, totals: totals(2, 1, 1, 0) },
        { year: 2023, totals: totals(10, 0, 0, 0) },
      ]),
    ).toEqual([
      { year: 2023, commits: 1, pullRequests: 0, reviews: 0, issues: 0 },
      {
        year: 2024,
        commits: 0.5,
        pullRequests: 0.25,
        reviews: 0.25,
        issues: 0,
      },
    ]);
  });

  it("gives zero shares to a year without any role", () => {
    expect(roleMix([{ year: 2022, totals: totals(0, 0, 0, 0) }])).toEqual([
      { year: 2022, commits: 0, pullRequests: 0, reviews: 0, issues: 0 },
    ]);
  });
});
