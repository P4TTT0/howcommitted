import { describe, expect, it } from "vitest";
import type { History } from "@/domain/history";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { mixReading, planMix } from "./mix";

function withTotals(
  year: number,
  totals: Partial<History["totals"]>,
): History["years"][number] {
  return {
    ...makeYear(year, steadyDays(year, 1)),
    totals: {
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      privateContributions: 0,
      ...totals,
    },
  };
}

const FIRST = { commits: 92, pullRequests: 4, issues: 4 };
const LATEST = { commits: 57, pullRequests: 17, reviews: 22, issues: 4 };

describe("planMix", () => {
  it("compares the first and the latest year with activity", () => {
    const plan = planMix(
      makeHistory("ada", [
        withTotals(2016, FIRST),
        withTotals(2020, { commits: 50, reviews: 50 }),
        withTotals(2026, LATEST),
      ]),
    );
    expect(plan?.rows.map((row) => row.year)).toEqual([2016, 2026]);
    expect(plan?.rows[0].segments.map((s) => s.percent)).toEqual([92, 4, 0, 4]);
    expect(plan?.rows[1].segments.map((s) => s.percent)).toEqual([
      57, 17, 22, 4,
    ]);
  });

  it("skips years with no commits, pull requests, reviews or issues", () => {
    const plan = planMix(
      makeHistory("ada", [
        withTotals(2015, { privateContributions: 40 }),
        withTotals(2016, { commits: 10 }),
        withTotals(2017, { commits: 5, reviews: 5 }),
      ]),
    );
    expect(plan?.rows.map((row) => row.year)).toEqual([2016, 2017]);
  });

  it("is null with a single active year", () => {
    expect(
      planMix(makeHistory("ada", [withTotals(2024, { commits: 10 })])),
    ).toBeNull();
    expect(
      planMix(
        makeHistory("ada", [
          withTotals(2023, {}),
          withTotals(2024, { commits: 3 }),
        ]),
      ),
    ).toBeNull();
  });

  it("states shares in text, without judging", () => {
    const plan = planMix(
      makeHistory("ada", [withTotals(2016, FIRST), withTotals(2026, LATEST)]),
    );
    expect(plan?.summary).toBe(
      "2016: 92% commits, 4% pull requests. 2026: 57% commits, 22% reviews.",
    );
    expect(plan?.summary).not.toMatch(/best|winner|most productive/i);
    expect(plan && mixReading(plan.rows[1])).toBe(
      "2026: 57% commits, 17% pull requests, 22% reviews, 4% issues",
    );
  });
});
