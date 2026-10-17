import { describe, expect, it } from "vitest";
import {
  activeBarIndex,
  GRID_SECONDS,
  planYearBars,
  riseProgress,
} from "./bars";

const blocks = [
  { year: 2022, contributions: 200 },
  { year: 2024, contributions: 800 },
  { year: 2025, contributions: 400 },
];

describe("planYearBars", () => {
  it("makes one bar per year in range, quiet years as zeros", () => {
    const { bars } = planYearBars(blocks, 2022, 2025);
    expect(bars.map((bar) => [bar.year, bar.contributions])).toEqual([
      [2022, 200],
      [2023, 0],
      [2024, 800],
      [2025, 400],
    ]);
  });

  it("scales height by the calendar total against the tallest year", () => {
    const { bars } = planYearBars(blocks, 2022, 2025);
    expect(bars.map((bar) => bar.ratio)).toEqual([0.25, 0, 1, 0.5]);
  });

  it("gives each year its palette position from the first year", () => {
    const { bars } = planYearBars(blocks, 2022, 2025);
    expect(bars.map((bar) => bar.colorIndex)).toEqual([0, 1, 2, 3]);
  });

  it("places every block on the tempo grid, in order", () => {
    const { bars } = planYearBars(blocks, 2022, 2025);
    for (const bar of bars) {
      const cells = bar.time / GRID_SECONDS;
      expect(Math.abs(cells - Math.round(cells))).toBeLessThan(1e-6);
    }
    const times = bars.map((bar) => bar.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it("climbs the scale from the first to the last year", () => {
    const { bars } = planYearBars(blocks, 2022, 2025);
    expect(bars[0]?.degree).toBe(0);
    expect(bars.at(-1)?.degree).toBe(10);
  });

  it("keeps a single year drawable and a long history short", () => {
    const single = planYearBars([{ year: 2024, contributions: 5 }], 2024, 2024);
    expect(single.bars).toHaveLength(1);
    expect(single.bars[0]?.ratio).toBe(1);
    expect(single.duration).toBeGreaterThanOrEqual(4);

    const long = planYearBars([], 2000, 2025);
    expect(long.duration).toBeLessThan(12);
  });

  it("does not divide by zero when every year is empty", () => {
    const { bars } = planYearBars([], 2023, 2024);
    expect(bars.map((bar) => bar.ratio)).toEqual([0, 0]);
  });
});

describe("riseProgress and activeBarIndex", () => {
  const bar = { time: 1 };

  it("is 0 before the bar and 1 once it has risen", () => {
    expect(riseProgress(bar, 0.5, false)).toBe(0);
    expect(riseProgress(bar, 5, false)).toBe(1);
    expect(riseProgress(bar, 1.2, false)).toBeGreaterThan(0);
    expect(riseProgress(bar, 1.2, false)).toBeLessThan(1);
  });

  it("snaps with reduced motion", () => {
    expect(riseProgress(bar, 1, true)).toBe(1);
    expect(riseProgress(bar, 0.9, true)).toBe(0);
  });

  it("follows the latest bar that has started", () => {
    const bars = [{ time: 0.4 }, { time: 1 }, { time: 2 }];
    expect(activeBarIndex(bars, 0)).toBe(0);
    expect(activeBarIndex(bars, 1.5)).toBe(1);
    expect(activeBarIndex(bars, 99)).toBe(2);
  });
});
