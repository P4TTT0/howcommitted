import { describe, expect, it } from "vitest";
import type { DailyContributions } from "./types";
import { yearCompare } from "./year-compare";

const d = (date: string, count = 1): DailyContributions => ({ date, count });

describe("yearCompare", () => {
  const days = [d("2023-12-31", 2), d("2024-01-01", 3), d("2024-01-02")];

  it("reports each year on its own, with streaks cut at the year edge", () => {
    const { a, b } = yearCompare(days, 2023, 2024);
    expect(a).toMatchObject({
      year: 2023,
      total: 2,
      activeDays: 1,
      longestStreak: 1,
      weekendShare: 1,
    });
    expect(a.weekShape.weekdays).toEqual([0, 0, 0, 0, 0, 0, 2]);
    expect(b).toMatchObject({
      year: 2024,
      total: 4,
      activeDays: 2,
      longestStreak: 2,
      weekendShare: 0,
    });
    expect(b.weekShape.weekdays).toEqual([3, 1, 0, 0, 0, 0, 0]);
  });

  it("returns zeros for a year with no active days", () => {
    const { a } = yearCompare(days, 2022, 2024);
    expect(a).toMatchObject({
      total: 0,
      activeDays: 0,
      longestStreak: 0,
      weekendShare: 0,
    });
    expect(a.weekShape.archetype).toBeNull();
  });

  it("handles an empty history and an in-progress year", () => {
    expect(yearCompare([], 2025, 2026).b.total).toBe(0);
    const { b } = yearCompare([d("2026-02-28")], 2025, 2026);
    expect(b.activeDays).toBe(1);
  });

  it("keeps a leap day inside its year", () => {
    const { b } = yearCompare([d("2024-02-29", 2)], 2023, 2024);
    expect(b).toMatchObject({ total: 2, longestStreak: 1 });
  });
});
