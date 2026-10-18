import { describe, expect, it } from "vitest";
import { addDays } from "./activity";
import { rhythm } from "./rhythm";
import type { DailyContributions } from "./types";

const d = (date: string, count = 1): DailyContributions => ({ date, count });

describe("rhythm", () => {
  it("is empty without activity", () => {
    expect(rhythm([])).toEqual({
      topDaysShare: 0,
      activeWeekShare: 0,
      position: 0,
      label: null,
    });
  });

  it("reads a single day as steady, not bursty", () => {
    expect(rhythm([d("2024-02-29", 9)])).toEqual({
      topDaysShare: 1,
      activeWeekShare: 1,
      position: 0,
      label: "steady",
    });
  });

  it("is steady for the same effort every day", () => {
    const days = Array.from({ length: 20 }, (_, i) =>
      d(addDays("2024-01-01", i)),
    );
    const result = rhythm(days);
    expect(result.topDaysShare).toBeCloseTo(0.1);
    expect(result.activeWeekShare).toBe(1);
    expect(result.position).toBeCloseTo(0);
    expect(result.label).toBe("steady");
  });

  it("is bursty for one huge day among sparse weeks", () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      d(addDays("2024-01-01", i * 14), i === 0 ? 100 : 1),
    );
    const result = rhythm(days);
    expect(result.topDaysShare).toBeCloseTo(100 / 109);
    expect(result.activeWeekShare).toBeCloseTo(10 / 19);
    expect(result.position).toBeCloseTo(0.691, 2);
    expect(result.label).toBe("bursty");
  });

  it("counts weeks with a gap inside the span", () => {
    const result = rhythm([d("2024-01-01"), d("2024-01-22")]);
    expect(result.activeWeekShare).toBeCloseTo(2 / 4);
  });

  it("stays within 0..1", () => {
    const result = rhythm([d("2024-01-01", 1000), d("2030-01-01")]);
    expect(result.position).toBeGreaterThanOrEqual(0);
    expect(result.position).toBeLessThanOrEqual(1);
  });
});
