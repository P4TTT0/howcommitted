import { describe, expect, it } from "vitest";
import type { DailyContributions } from "@/domain/types";
import { monthName, planMonthStrip, seasonOf } from "./months";

/** One active day on the 15th of every month of the years, with a count by month. */
function year(
  y: number,
  countOf: (month: number) => number,
): DailyContributions[] {
  return Array.from({ length: 12 }, (_, i) => ({
    date: `${y}-${String(i + 1).padStart(2, "0")}-15`,
    count: countOf(i + 1),
  }));
}

describe("seasonOf", () => {
  it("names the calendar season, northern-hemisphere convention", () => {
    expect(
      [12, 1, 2, 3, 5, 6, 8, 9, 11].map((month) => seasonOf(month)),
    ).toEqual([
      "Winter",
      "Winter",
      "Winter",
      "Spring",
      "Spring",
      "Summer",
      "Summer",
      "Autumn",
      "Autumn",
    ]);
  });
});

describe("planMonthStrip", () => {
  const days = [
    ...year(2023, (m) => (m === 3 ? 50 : m === 8 || m === 12 ? 2 : 20)),
    ...year(2024, (m) => (m === 3 ? 54 : m === 8 || m === 12 ? 2 : 22)),
  ];
  const strip = planMonthStrip(days);

  it("names the season and the month of the top average", () => {
    expect(strip?.headline).toBe("Spring builder. March is your month.");
  });

  it("draws twelve bars, the top one at full height and flagged", () => {
    expect(strip?.bars).toHaveLength(12);
    const top = strip?.bars.filter((bar) => bar.isTop);
    expect(top?.map((bar) => [bar.month, bar.ratio])).toEqual([[3, 1]]);
  });

  it("dashes quiet months and names them", () => {
    const quiet = strip?.bars.filter((bar) => bar.isQuiet);
    expect(quiet?.map((bar) => bar.month)).toEqual([8, 12]);
    expect(strip?.detail).toBe(
      "Average per month across every year. August and December run quiet.",
    );
  });

  it("says nothing without a top month", () => {
    expect(planMonthStrip([])).toBeNull();
  });

  it("says nothing when some calendar month was never lived through", () => {
    const partial = [
      { date: "2024-03-01", count: 5 },
      { date: "2024-04-01", count: 9 },
    ];
    expect(planMonthStrip(partial)).toBeNull();
  });

  it("names a month", () => {
    expect(monthName(8)).toBe("August");
  });
});
