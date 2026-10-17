import { describe, expect, it } from "vitest";
import type { HeatmapCell } from "@/domain/heatmap";
import {
  cellIndexAt,
  cellReading,
  indexAfterGridKey,
  latestYearCells,
  planReveal,
  weekProgress,
} from "./plan";

function cell(week: number, weekday: number, contributions = 1): HeatmapCell {
  return { date: "2025-01-01", week, weekday, contributions, level: 1 };
}

describe("latestYearCells", () => {
  it("picks the newest year that has days", () => {
    const cells = [cell(0, 0)];
    expect(
      latestYearCells([
        { year: 2024, heatmap: cells },
        { year: 2025, heatmap: [] },
      ]),
    ).toEqual({ year: 2024, cells });
    expect(latestYearCells([])).toBeNull();
  });
});

describe("planReveal", () => {
  const cells = Array.from({ length: 53 }, (_, week) => cell(week, 3, week));
  const plan = planReveal(cells);

  it("reveals weeks in order on the grid", () => {
    expect(plan.weeks).toBe(53);
    expect(plan.weekTimes).toEqual([...plan.weekTimes].sort((a, b) => a - b));
    expect(plan.duration).toBeGreaterThan(plan.weekTimes.at(-1) ?? 0);
  });

  it("aggregates sound: far fewer ticks than days", () => {
    expect(plan.ticks.length).toBeLessThanOrEqual(14);
    for (const tick of plan.ticks) {
      expect(tick.intensity).toBeGreaterThan(0.4);
      expect(tick.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("stays silent for a year without contributions", () => {
    expect(planReveal([cell(0, 0, 0), cell(1, 0, 0)]).ticks).toEqual([]);
  });
});

describe("weekProgress", () => {
  it("is 0 before, 1 after, and instant with reduced motion", () => {
    expect(weekProgress(1, 0.5, false)).toBe(0);
    expect(weekProgress(1, 5, false)).toBe(1);
    expect(weekProgress(1, 1.01, true)).toBe(1);
  });
});

describe("grid navigation", () => {
  it("finds cells by position", () => {
    const cells = [cell(0, 5), cell(1, 0)];
    expect(cellIndexAt(cells, 1, 0)).toBe(1);
    expect(cellIndexAt(cells, 0, 0)).toBeNull();
  });

  it("moves by day and by week, clamped", () => {
    expect(indexAfterGridKey("ArrowDown", 3, 100)).toBe(4);
    expect(indexAfterGridKey("ArrowRight", 3, 100)).toBe(10);
    expect(indexAfterGridKey("ArrowLeft", 3, 100)).toBe(0);
    expect(indexAfterGridKey("End", 3, 100)).toBe(99);
    expect(indexAfterGridKey("a", 3, 100)).toBeNull();
  });
});

describe("cellReading", () => {
  it("names the date and says contributions, never commits", () => {
    expect(cellReading({ date: "2025-03-04", contributions: 1234 })).toBe(
      "Mar 4, 2025: 1,234 contributions",
    );
    expect(cellReading({ date: "2025-03-04", contributions: 1 })).toBe(
      "Mar 4, 2025: 1 contribution",
    );
  });
});
