import { describe, expect, it } from "vitest";
import {
  activeDates,
  mondayFirstWeekday,
  sharedCount,
  sharedDays,
  sharedStats,
} from "./shared-days";

describe("activeDates", () => {
  it("keeps only days with a contribution", () => {
    const dates = activeDates([
      { date: "2024-01-01", count: 2 },
      { date: "2024-01-02", count: 0 },
    ]);
    expect([...dates]).toEqual(["2024-01-01"]);
  });
});

describe("sharedDays", () => {
  const ada = new Set(["2024-01-01", "2024-01-02", "2024-01-03"]);
  const grace = new Set(["2024-01-02", "2024-01-03", "2024-01-05"]);

  it("lists every day of a year", () => {
    expect(sharedDays(2024, [ada, grace])).toHaveLength(366);
    expect(sharedDays(2023, [ada, grace])).toHaveLength(365);
  });

  it("stops at the last known date", () => {
    expect(sharedDays(2024, [ada, grace], "2024-01-10")).toHaveLength(10);
    expect(sharedDays(2024, [ada, grace], "2025-06-01")).toHaveLength(366);
  });

  it("splits a day between everyone who contributed", () => {
    const days = sharedDays(2024, [ada, grace]);
    expect(days[0]?.people).toEqual([0]);
    expect(days[1]?.people).toEqual([0, 1]);
    expect(days[3]?.people).toEqual([]);
    expect(days[4]?.people).toEqual([1]);
  });
});

describe("sharedStats", () => {
  it("counts everyone, anyone, the longest run together and each person", () => {
    const a = new Set(["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-05"]);
    const b = new Set(["2024-01-02", "2024-01-03", "2024-01-05", "2024-01-06"]);
    const days = sharedDays(2024, [a, b], "2024-01-07");
    expect(sharedStats(days, 2)).toEqual({
      everyone: 3,
      anyone: 5,
      longestRun: 2,
      perPerson: [4, 4],
    });
    expect(sharedCount(days)).toBe(3);
  });

  it("is empty for nobody", () => {
    expect(sharedStats([], 0)).toEqual({
      everyone: 0,
      anyone: 0,
      longestRun: 0,
      perPerson: [],
    });
  });
});

describe("mondayFirstWeekday", () => {
  it("puts Monday at 0 and Sunday at 6", () => {
    expect(mondayFirstWeekday("2024-01-01")).toBe(0);
    expect(mondayFirstWeekday("2024-01-07")).toBe(6);
  });
});
