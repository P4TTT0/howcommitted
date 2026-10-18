import { describe, expect, it } from "vitest";
import { monthShape } from "./month-shape";
import type { DailyContributions } from "./types";

const d = (date: string, count = 1): DailyContributions => ({ date, count });

describe("monthShape", () => {
  it("is empty without activity", () => {
    const shape = monthShape([]);
    expect(shape.topMonth).toBeNull();
    expect(shape.quietMonths).toEqual([]);
    expect(shape.months).toHaveLength(12);
    expect(shape.months.every((m) => m.average === null)).toBe(true);
  });

  it("only averages months that exist inside the span", () => {
    const shape = monthShape([
      d("2023-12-15", 10),
      d("2024-01-10", 20),
      d("2024-02-05", 2),
    ]);
    expect(shape.months[11]).toEqual({
      month: 12,
      average: 10,
      occurrences: 1,
    });
    expect(shape.months[0]).toEqual({ month: 1, average: 20, occurrences: 1 });
    expect(shape.months[2]).toEqual({
      month: 3,
      average: null,
      occurrences: 0,
    });
    expect(shape.topMonth).toBe(1);
    expect(shape.quietMonths).toEqual([2]);
  });

  it("divides by every occurrence of a month, quiet ones included", () => {
    const shape = monthShape([d("2023-01-05", 4), d("2024-01-05", 8)]);
    expect(shape.months[0]).toEqual({ month: 1, average: 6, occurrences: 2 });
    expect(shape.months[1]).toEqual({ month: 2, average: 0, occurrences: 1 });
    expect(shape.topMonth).toBe(1);
    expect(shape.quietMonths).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("stops at the last active month of a year in progress", () => {
    const shape = monthShape([d("2026-01-10", 3), d("2026-03-10", 3)]);
    expect(shape.months[3]?.occurrences).toBe(0);
    expect(shape.months[1]?.average).toBe(0);
    expect(shape.quietMonths).toEqual([2]);
  });

  it("handles a single leap day", () => {
    const shape = monthShape([d("2024-02-29", 2)]);
    expect(shape.months[1]).toEqual({ month: 2, average: 2, occurrences: 1 });
    expect(shape.topMonth).toBe(2);
    expect(shape.quietMonths).toEqual([]);
  });

  it("ties on the top month go to the earliest in the calendar", () => {
    const shape = monthShape([d("2024-01-10", 5), d("2024-02-10", 5)]);
    expect(shape.topMonth).toBe(1);
  });
});
