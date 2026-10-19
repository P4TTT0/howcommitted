import { describe, expect, it } from "vitest";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import {
  axisMaxFor,
  dayLevel,
  dayReading,
  planThenNow,
  progressAt,
  summaryLine,
} from "./plan";

const TODAY = new Date(Date.UTC(2026, 5, 1));

function history(years: [number, number, number][]) {
  return makeHistory(
    "ada",
    years.map(([year, count, every]) =>
      makeYear(year, steadyDays(year, count, every)),
    ),
  );
}

describe("planThenNow", () => {
  it("needs two full years", () => {
    expect(planThenNow(history([[2025, 1, 3]]), TODAY)).toBeNull();
    expect(
      planThenNow(
        history([
          [2025, 1, 3],
          [2026, 1, 3],
        ]),
        TODAY,
      ),
    ).toBeNull();
  });

  it("uses the previous year as now while the current one is in progress", () => {
    const plan = planThenNow(
      history([
        [2023, 1, 3],
        [2024, 1, 3],
        [2025, 1, 3],
        [2026, 1, 3],
      ]),
      TODAY,
    );
    expect(plan?.nowYear).toBe(2025);
    expect(plan?.years).toEqual([2023, 2024]);
  });

  it("starts at the busiest past year", () => {
    const plan = planThenNow(
      history([
        [2022, 1, 3],
        [2023, 5, 3],
        [2024, 2, 3],
        [2025, 9, 3],
      ]),
      TODAY,
    );
    expect(plan?.defaultThen).toBe(2023);
  });

  it("compares any past year with now", () => {
    const plan = planThenNow(
      history([
        [2023, 1, 7],
        [2024, 2, 1],
        [2025, 1, 1],
      ]),
      TODAY,
    );
    const { earlier, now, summary } = plan?.compare(2023) ?? {};
    expect(earlier).toMatchObject({ year: 2023, tag: "Then" });
    expect(now).toMatchObject({ year: 2025, activeDays: 365 });
    expect(earlier?.week).toHaveLength(7);
    const shares = earlier?.week.reduce((sum, n) => sum + n, 0) ?? 0;
    expect(shares).toBeCloseTo(1);
    expect(summary).toMatch(/^Since 2023: /);
    expect(earlier?.reading).toContain("contributions");
  });

  it("schedules then, now and the summary in order within the duration", () => {
    const plan = planThenNow(
      history([
        [2024, 1, 3],
        [2025, 1, 3],
      ]),
      TODAY,
    );
    expect(plan?.nowTime).toBeGreaterThan(plan?.thenTime ?? 0);
    expect(plan?.summaryTime).toBeGreaterThan(plan?.nowTime ?? 0);
    expect(plan?.duration).toBeGreaterThan(plan?.summaryTime ?? 0);
  });
});

describe("summaryLine", () => {
  const stats = (overrides: object) => ({
    year: 2020,
    total: 100,
    activeDays: 50,
    longestStreak: 3,
    weekShape: {
      weekdays: [0, 0, 0, 0, 0, 0, 0],
      total: 0,
      weekendShare: 0.2,
      monThuShare: 0.5,
      archetype: null,
    },
    weekendShare: 0.2,
    ...overrides,
  });

  it("describes spread and weekends without ranking", () => {
    expect(
      summaryLine(
        stats({}),
        stats({ year: 2025, activeDays: 100, weekendShare: 0.3 }),
      ),
    ).toBe("Since 2020: spread across more days. More of it on weekends now.");
    expect(
      summaryLine(
        stats({}),
        stats({ year: 2025, activeDays: 25, weekendShare: 0.1 }),
      ),
    ).toBe("Since 2020: packed into fewer days. Less of it on weekends now.");
    expect(summaryLine(stats({}), stats({ year: 2025 }))).toBe(
      "Since 2020: spread the same way. Weekends held steady.",
    );
  });
});

describe("progressAt", () => {
  it("eases and honors reduced motion", () => {
    expect(progressAt(1, 1, 0.5, false)).toBe(0);
    expect(progressAt(1, 1, 3, false)).toBe(1);
    expect(progressAt(1, 1, 1.01, true)).toBe(1);
  });
});

describe("axisMaxFor", () => {
  it("fits the tallest share on a 5% grid in three steps", () => {
    expect(axisMaxFor([0.1, 0.16])).toBeCloseTo(0.3);
    expect(axisMaxFor([0.3, 0.1])).toBeCloseTo(0.3);
    expect(axisMaxFor([0.31])).toBeCloseTo(0.45);
    expect(axisMaxFor([0, 0])).toBeCloseTo(0.15);
  });
});

describe("dayReading", () => {
  it("reads both years for one weekday", () => {
    const plan = planThenNow(
      history([
        [2023, 1, 7],
        [2025, 1, 7],
      ]),
      TODAY,
    );
    if (!plan) throw new Error("expected a plan");
    const reading = dayReading(plan.compare(2023), 1);
    expect(reading.day).toBe("Tuesday");
    expect(reading.detail).toMatch(/^2023: \d+ \(\d+%\) · 2025: \d+ \(\d+%\)$/);
    expect(reading.label).toBe(`Tuesday. ${reading.detail}`);
  });
});

describe("dayLevel", () => {
  it("is a 0..1 level for every weekday", () => {
    const plan = planThenNow(
      history([
        [2023, 1, 7],
        [2025, 1, 7],
      ]),
      TODAY,
    );
    if (!plan) throw new Error("expected a plan");
    const comparison = plan.compare(2023);
    for (let day = 0; day < 7; day++) {
      const level = dayLevel(comparison, day);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });
});
