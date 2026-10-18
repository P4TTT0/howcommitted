import { describe, expect, it } from "vitest";
import {
  peakWeekday,
  rhythmPairs,
  weekdayOverlap,
  weekdayShares,
} from "./versus-rhythm";

describe("weekdayShares", () => {
  it("turns counts into shares of their own total", () => {
    expect(weekdayShares([1, 1, 2, 0, 0, 0, 0])).toEqual([
      0.25, 0.25, 0.5, 0, 0, 0, 0,
    ]);
  });

  it("is all zeros without activity", () => {
    expect(weekdayShares([0, 0, 0, 0, 0, 0, 0])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("weekdayOverlap", () => {
  it("is 1 for the same shape at any volume", () => {
    expect(
      weekdayOverlap([1, 2, 3, 0, 0, 0, 0], [10, 20, 30, 0, 0, 0, 0]),
    ).toBe(1);
  });

  it("is 0 for shapes that never share a weekday", () => {
    expect(weekdayOverlap([5, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 5])).toBe(
      0,
    );
  });

  it("adds the smaller share of each weekday", () => {
    // Shares 0.5/0.5 against 0.25/0.75 overlap by 0.25 + 0.5.
    expect(
      weekdayOverlap([2, 2, 0, 0, 0, 0, 0], [1, 3, 0, 0, 0, 0, 0]),
    ).toBeCloseTo(0.75);
  });

  it("is null when either side has no activity", () => {
    expect(weekdayOverlap([0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0])).toBe(
      null,
    );
  });
});

describe("peakWeekday", () => {
  it("returns the busiest weekday, Monday first, earliest on ties", () => {
    expect(peakWeekday([1, 4, 4, 0, 0, 0, 0])).toBe(1);
  });

  it("is null without activity", () => {
    expect(peakWeekday([0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});

describe("rhythmPairs", () => {
  const midweek = [4, 5, 5, 4, 2, 0, 0];
  const alsoMidweek = [3, 4, 4, 3, 1, 0, 0];
  const weekend = [0, 0, 0, 0, 1, 6, 5];

  it("finds the closest and the furthest pair", () => {
    const { closest, furthest } = rhythmPairs([midweek, weekend, alsoMidweek]);
    expect(closest).toMatchObject({ a: 0, b: 2 });
    expect(furthest).toMatchObject({ a: 1, b: 2 });
    expect(closest?.overlap).toBeGreaterThan(furthest?.overlap ?? 1);
  });

  it("has a single pair for two developers", () => {
    const { closest, furthest } = rhythmPairs([midweek, weekend]);
    expect(closest).toMatchObject({ a: 0, b: 1 });
    expect(furthest).toBeNull();
  });

  it("leaves out developers without activity", () => {
    const { closest } = rhythmPairs([midweek, [0, 0, 0, 0, 0, 0, 0], weekend]);
    expect(closest).toMatchObject({ a: 0, b: 2 });
  });

  it("finds nothing for fewer than two active developers", () => {
    expect(rhythmPairs([midweek])).toEqual({ closest: null, furthest: null });
  });
});
