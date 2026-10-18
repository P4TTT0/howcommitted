import { describe, expect, it } from "vitest";
import { weekdayIndex } from "./activity";
import type { DailyContributions } from "./types";
import { weekShape } from "./week-shape";

const d = (date: string, count = 1): DailyContributions => ({ date, count });

describe("weekdayIndex", () => {
  it("starts the week on Monday (UTC)", () => {
    expect(weekdayIndex("2024-01-01")).toBe(0);
    expect(weekdayIndex("2024-02-29")).toBe(3);
    expect(weekdayIndex("2024-01-07")).toBe(6);
  });
});

describe("weekShape", () => {
  it("is empty without activity", () => {
    expect(weekShape([])).toEqual({
      weekdays: [0, 0, 0, 0, 0, 0, 0],
      total: 0,
      weekendShare: 0,
      monThuShare: 0,
      archetype: null,
    });
  });

  it("totals per weekday, Monday first", () => {
    const shape = weekShape([
      d("2024-01-01", 3),
      d("2024-01-06"),
      d("2024-01-07"),
    ]);
    expect(shape.weekdays).toEqual([3, 0, 0, 0, 0, 1, 1]);
    expect(shape.total).toBe(5);
    expect(shape.weekendShare).toBeCloseTo(0.4);
    expect(shape.monThuShare).toBeCloseTo(0.6);
    expect(shape.archetype).toBe("Weekend regular");
  });

  it("labels a weekday-heavy week", () => {
    const shape = weekShape([
      d("2024-01-01"),
      d("2024-01-02"),
      d("2024-01-03"),
      d("2024-01-04"),
      d("2024-01-05"),
    ]);
    expect(shape.monThuShare).toBeCloseTo(0.8);
    expect(shape.archetype).toBe("Weekday builder");
  });

  it("labels an even week", () => {
    const days = Array.from({ length: 7 }, (_, i) => d(`2024-01-0${i + 1}`));
    expect(weekShape(days).archetype).toBe("Steady all week");
  });

  it("puts a single leap-day Thursday in the right bucket", () => {
    const shape = weekShape([d("2024-02-29", 2)]);
    expect(shape.weekdays[3]).toBe(2);
    expect(shape.archetype).toBe("Weekday builder");
  });
});
