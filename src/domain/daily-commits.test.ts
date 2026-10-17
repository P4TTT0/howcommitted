import { describe, expect, it } from "vitest";
import {
  reconcileCommits,
  sumDailyCommits,
  totalCommits,
} from "./daily-commits";

describe("sumDailyCommits", () => {
  it("sums the same day across repositories and sorts by date", () => {
    const result = sumDailyCommits([
      [
        { occurredAt: "2023-01-02T00:00:00Z", commitCount: 3 },
        { occurredAt: "2023-01-01T00:00:00Z", commitCount: 1 },
      ],
      [{ occurredAt: "2023-01-02T00:00:00Z", commitCount: 2 }],
    ]);
    expect(result).toEqual([
      { date: "2023-01-01", commits: 1 },
      { date: "2023-01-02", commits: 5 },
    ]);
    expect(totalCommits(result)).toBe(6);
  });

  it("ignores empty entries", () => {
    expect(
      sumDailyCommits([
        [{ occurredAt: "2023-01-01T00:00:00Z", commitCount: 0 }],
      ]),
    ).toEqual([]);
  });
});

describe("reconcileCommits", () => {
  it("flags a match", () => {
    expect(reconcileCommits(4458, 4458)).toEqual({
      summed: 4458,
      official: 4458,
      difference: 0,
      matches: true,
    });
  });

  it("flags a mismatch with the missing amount", () => {
    const result = reconcileCommits(90, 100);
    expect(result.matches).toBe(false);
    expect(result.difference).toBe(10);
  });
});
