import { describe, expect, it } from "vitest";
import { records } from "./records";
import type { DailyContributions } from "./types";

const d = (date: string, count = 1): DailyContributions => ({ date, count });

describe("records", () => {
  it("is empty without activity", () => {
    expect(records([])).toEqual({
      longestStreak: { length: 0, start: null, end: null },
      busiestDay: null,
      averagePerActiveDay: 0,
      activeDays: 0,
      firstDate: null,
      lastDate: null,
      longestQuiet: null,
      busiestWeek: null,
      busiestMonth: null,
      busiestYear: null,
      yourDate: null,
    });
    expect(records([d("2024-01-01", 0)]).activeDays).toBe(0);
  });

  it("handles a single day that is a leap day", () => {
    expect(records([d("2024-02-29", 3)])).toEqual({
      longestStreak: { length: 1, start: "2024-02-29", end: "2024-02-29" },
      busiestDay: { count: 3, date: "2024-02-29" },
      averagePerActiveDay: 3,
      activeDays: 1,
      firstDate: "2024-02-29",
      lastDate: "2024-02-29",
      longestQuiet: null,
      busiestWeek: { count: 3, start: "2024-02-26", end: "2024-03-03" },
      busiestMonth: { count: 3, month: "2024-02" },
      busiestYear: { count: 3, year: 2024 },
      yourDate: { monthDay: "02-29", years: 1, totalYears: 1 },
    });
  });

  it("computes the records over several years", () => {
    const result = records([
      d("2024-01-03"),
      d("2023-02-10", 4),
      d("2023-01-04", 2),
      d("2023-01-03", 5),
      d("2023-01-02"),
      d("2024-01-02"),
    ]);
    expect(result.longestStreak).toEqual({
      length: 3,
      start: "2023-01-02",
      end: "2023-01-04",
    });
    expect(result.busiestDay).toEqual({ count: 5, date: "2023-01-03" });
    expect(result.activeDays).toBe(6);
    expect(result.averagePerActiveDay).toBeCloseTo(14 / 6);
    expect(result.firstDate).toBe("2023-01-02");
    expect(result.lastDate).toBe("2024-01-03");
    expect(result.longestQuiet).toEqual({
      length: 325,
      start: "2023-02-11",
      end: "2024-01-01",
      comeback: "2024-01-02",
    });
    expect(result.busiestWeek).toEqual({
      count: 8,
      start: "2023-01-02",
      end: "2023-01-08",
    });
    expect(result.busiestMonth).toEqual({ count: 8, month: "2023-01" });
    expect(result.busiestYear).toEqual({ count: 12, year: 2023 });
  });

  it("counts a date once when adjacent calendars repeat it, and ignores zeros", () => {
    const result = records([
      d("2023-12-31", 2),
      d("2023-12-31", 2),
      d("2024-01-01", 0),
    ]);
    expect(result.activeDays).toBe(1);
    expect(result.busiestDay?.count).toBe(2);
  });

  it("breaks ties toward the earliest period", () => {
    const result = records([d("2023-03-01", 2), d("2022-03-01", 2)]);
    expect(result.busiestDay).toEqual({ count: 2, date: "2022-03-01" });
    expect(result.busiestYear?.year).toBe(2022);
    expect(result.busiestMonth?.month).toBe("2022-03");
  });

  it("keeps the earliest quiet stretch when two are equal", () => {
    const result = records([d("2024-01-01"), d("2024-01-04"), d("2024-01-07")]);
    expect(result.longestQuiet).toEqual({
      length: 2,
      start: "2024-01-02",
      end: "2024-01-03",
      comeback: "2024-01-04",
    });
  });

  it("has no quiet stretch for consecutive days", () => {
    expect(records([d("2024-01-01"), d("2024-01-02")]).longestQuiet).toBeNull();
  });

  describe("yourDate", () => {
    it("ties on years go to the earliest MM-DD when the last year is equal", () => {
      const result = records([
        d("2023-01-02"),
        d("2024-01-02"),
        d("2023-01-03"),
        d("2024-01-03"),
      ]);
      expect(result.yourDate).toEqual({
        monthDay: "01-02",
        years: 2,
        totalYears: 2,
      });
    });

    it("ties on years go to the most recent last-active date", () => {
      const result = records([
        d("2021-03-01"),
        d("2022-03-01"),
        d("2022-05-05"),
        d("2023-05-05"),
      ]);
      expect(result.yourDate).toEqual({
        monthDay: "05-05",
        years: 2,
        totalYears: 3,
      });
    });

    it("prefers more distinct years over recency", () => {
      const result = records([
        d("2021-03-01"),
        d("2022-03-01"),
        d("2023-03-01"),
        d("2023-09-09"),
      ]);
      expect(result.yourDate?.monthDay).toBe("03-01");
      expect(result.yourDate?.years).toBe(3);
    });

    it("finds a leap day seen in two leap years", () => {
      const result = records([
        d("2020-02-29"),
        d("2024-02-29"),
        d("2022-02-28"),
      ]);
      expect(result.yourDate).toEqual({
        monthDay: "02-29",
        years: 2,
        totalYears: 5,
      });
    });
  });

  it("works for an in-progress year: the span ends at the last active day", () => {
    const result = records([d("2025-12-30", 2), d("2026-03-01", 3)]);
    expect(result.lastDate).toBe("2026-03-01");
    expect(result.busiestYear).toEqual({ count: 3, year: 2026 });
    expect(result.yourDate?.totalYears).toBe(2);
  });
});
