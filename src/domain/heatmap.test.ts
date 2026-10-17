import { describe, expect, it } from "vitest";
import { buildHeatmap } from "./heatmap";
import type { CalendarDay } from "./types";

const day = (date: string, count: number, weekday: number): CalendarDay => ({
  date,
  count,
  weekday,
});

describe("buildHeatmap", () => {
  it("places days on week and weekday and scales levels", () => {
    // 2023-01-01 is a Sunday.
    const cells = buildHeatmap([
      day("2023-01-08", 8, 0),
      day("2023-01-01", 0, 0),
      day("2023-01-04", 2, 3),
    ]);
    expect(cells.map((c) => [c.date, c.week, c.weekday, c.level])).toEqual([
      ["2023-01-01", 0, 0, 0],
      ["2023-01-04", 0, 3, 1],
      ["2023-01-08", 1, 0, 4],
    ]);
  });

  it("counts a partial first week correctly", () => {
    // 2023-01-04 is a Wednesday; the following Sunday starts week 1.
    const cells = buildHeatmap([
      day("2023-01-04", 1, 3),
      day("2023-01-08", 1, 0),
    ]);
    expect(cells.map((c) => c.week)).toEqual([0, 1]);
  });

  it("handles the leap day", () => {
    // 2024-02-28 is a Wednesday.
    const cells = buildHeatmap([
      day("2024-02-28", 1, 3),
      day("2024-02-29", 1, 4),
      day("2024-03-01", 1, 5),
    ]);
    expect(cells.map((c) => [c.date, c.week, c.weekday])).toEqual([
      ["2024-02-28", 0, 3],
      ["2024-02-29", 0, 4],
      ["2024-03-01", 0, 5],
    ]);
  });

  it("uses 54 columns for a leap year that starts on a Saturday", () => {
    // 2000-01-01 is a Saturday and 2000-12-31 a Sunday, 365 days later.
    const cells = buildHeatmap([
      day("2000-01-01", 1, 6),
      day("2000-12-31", 1, 0),
    ]);
    expect(cells.map((c) => c.week)).toEqual([0, 53]);
  });

  it("returns an empty grid for no days", () => {
    expect(buildHeatmap([])).toEqual([]);
  });
});
