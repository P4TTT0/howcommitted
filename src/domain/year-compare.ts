import { activeDays, toCalendarDays } from "./activity";
import { longestStreak } from "./streaks";
import type { DailyContributions } from "./types";
import { type WeekShape, weekShape } from "./week-shape";

export type YearStats = {
  year: number;
  /** Sum of the daily contributions of the year. */
  total: number;
  activeDays: number;
  /** Longest run of active days that stays inside the year. */
  longestStreak: number;
  weekShape: WeekShape;
  weekendShare: number;
};

function statsFor(days: DailyContributions[], year: number): YearStats {
  const inYear = activeDays(days).filter((d) => d.date.startsWith(`${year}-`));
  const shape = weekShape(inYear);
  return {
    year,
    total: inYear.reduce((sum, d) => sum + d.count, 0),
    activeDays: inYear.length,
    longestStreak: longestStreak(toCalendarDays(inYear)).length,
    weekShape: shape,
    weekendShare: shape.weekendShare,
  };
}

/** Side by side stats for two years, from daily contributions of any span. */
export function yearCompare(
  days: DailyContributions[],
  a: number,
  b: number,
): { a: YearStats; b: YearStats } {
  return { a: statsFor(days, a), b: statsFor(days, b) };
}
