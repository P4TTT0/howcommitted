import { describe, expect, it } from "vitest";
import {
  aggregateWeekly,
  cumulativeAt,
  cumulativeByDay,
  type DailyCommits,
  weekSpan,
  yearAt,
  yearSpans,
} from "./aggregate";

function run(start: string, counts: number[]): DailyCommits[] {
  const origin = Date.parse(`${start}T00:00:00Z`);
  return counts.map((count, index) => ({
    date: new Date(origin + index * 86_400_000).toISOString().slice(0, 10),
    count,
  }));
}

describe("aggregateWeekly", () => {
  it("folds seven days into one week", () => {
    const days = run("2024-01-01", [1, 2, 0, 0, 3, 0, 1, 4, 0, 0, 0, 0, 0, 0]);
    expect(aggregateWeekly(days)).toEqual([
      { week: 0, count: 7 },
      { week: 1, count: 4 },
    ]);
  });

  it("omits weeks without commits and keeps week indexes", () => {
    const days = run(
      "2024-01-01",
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    );
    expect(aggregateWeekly(days)).toEqual([
      { week: 0, count: 1 },
      { week: 2, count: 5 },
    ]);
  });

  it("returns nothing for no data", () => {
    expect(aggregateWeekly([])).toEqual([]);
  });
});

describe("weekSpan", () => {
  it("counts partial weeks", () => {
    expect(weekSpan(run("2024-01-01", [1, 1, 1, 1, 1, 1, 1, 1]))).toBe(2);
    expect(weekSpan([])).toBe(0);
  });
});

describe("cumulativeAt", () => {
  const cumulative = cumulativeByDay(run("2024-01-01", [10, 0, 10, 10]));

  it("accumulates per day", () => {
    expect(cumulative).toEqual([10, 10, 20, 30]);
  });

  it("interpolates inside a day and clamps the ends", () => {
    expect(cumulativeAt(cumulative, 0)).toBe(0);
    expect(cumulativeAt(cumulative, 0.125)).toBe(5);
    expect(cumulativeAt(cumulative, 1)).toBe(30);
    expect(cumulativeAt(cumulative, 2)).toBe(30);
    expect(cumulativeAt([], 0.5)).toBe(0);
  });
});

describe("years", () => {
  const days = run("2023-12-30", [1, 1, 1, 1, 1]);
  const spans = yearSpans(days);

  it("finds the first day of each year", () => {
    expect(spans).toEqual([
      { year: 2023, startProgress: 0 },
      { year: 2024, startProgress: 0.4 },
    ]);
  });

  it("resolves the year at a progress", () => {
    expect(yearAt(spans, 0)).toBe(2023);
    expect(yearAt(spans, 0.39)).toBe(2023);
    expect(yearAt(spans, 0.4)).toBe(2024);
    expect(yearAt(spans, 1)).toBe(2024);
  });
});
