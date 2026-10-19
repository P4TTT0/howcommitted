import { describe, expect, it } from "vitest";
import {
  cellYears,
  easedPercent,
  PHRASES,
  phraseIndex,
  YEAR_CELLS,
  yearFill,
} from "./loadingProgress";

describe("easedPercent", () => {
  it("starts at zero and only moves forward", () => {
    expect(easedPercent(0)).toBe(0);
    expect(easedPercent(-5)).toBe(0);
    let last = 0;
    for (let ms = 0; ms <= 120_000; ms += 500) {
      const value = easedPercent(ms);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });

  it("never reaches 100, however long the wait", () => {
    expect(easedPercent(10 * 60_000)).toBe(99);
    expect(easedPercent(Number.POSITIVE_INFINITY)).toBe(99);
  });
});

describe("phraseIndex", () => {
  it("walks the list and stays in range", () => {
    expect(phraseIndex(0)).toBe(0);
    expect(phraseIndex(99)).toBe(PHRASES.length - 1);
    expect(phraseIndex(100)).toBe(PHRASES.length - 1);
  });
});

describe("yearFill", () => {
  it("fills cells one after another", () => {
    expect(yearFill(0, 0)).toBe(0);
    expect(yearFill(100, YEAR_CELLS - 1)).toBeCloseTo(1, 9);
    expect(yearFill(50, 0)).toBe(1);
    expect(yearFill(50, YEAR_CELLS - 1)).toBe(0);
    const mid = yearFill(50, 5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("cellYears", () => {
  it("ends on the current year", () => {
    const years = cellYears(new Date("2026-10-18T12:00:00Z"));
    expect(years).toHaveLength(YEAR_CELLS);
    expect(years[0]).toBe(2016);
    expect(years.at(-1)).toBe(2026);
  });
});
