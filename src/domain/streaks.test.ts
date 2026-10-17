import { describe, expect, it } from "vitest";
import { longestStreak } from "./streaks";
import type { CalendarDay } from "./types";

const day = (date: string, count: number, weekday: number): CalendarDay => ({
  date,
  count,
  weekday,
});

describe("longestStreak", () => {
  it("finds the longest consecutive run across a year boundary", () => {
    const streak = longestStreak([
      day("2022-12-30", 1, 5),
      day("2022-12-31", 2, 6),
      day("2023-01-01", 1, 0),
      day("2023-01-02", 0, 1),
      day("2023-01-03", 4, 2),
    ]);
    expect(streak).toEqual({
      length: 3,
      start: "2022-12-30",
      end: "2023-01-01",
    });
  });

  it("counts a day once when adjacent year calendars both include it", () => {
    const streak = longestStreak([
      day("2022-12-30", 1, 5),
      day("2022-12-31", 1, 6),
      day("2022-12-31", 1, 6),
      day("2023-01-01", 1, 0),
      day("2023-01-01", 1, 0),
    ]);
    expect(streak).toEqual({
      length: 3,
      start: "2022-12-30",
      end: "2023-01-01",
    });
  });

  it("keeps the earliest run when two runs tie", () => {
    const streak = longestStreak([
      day("2023-03-05", 1, 0),
      day("2023-03-06", 1, 1),
      day("2023-01-01", 1, 0),
      day("2023-01-02", 1, 1),
    ]);
    expect(streak).toEqual({
      length: 2,
      start: "2023-01-01",
      end: "2023-01-02",
    });
  });

  it("returns an empty streak without activity", () => {
    expect(longestStreak([day("2023-01-01", 0, 0)])).toEqual({
      length: 0,
      start: null,
      end: null,
    });
  });
});
