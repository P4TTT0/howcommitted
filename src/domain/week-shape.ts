import { activeDays, weekdayIndex } from "./activity";
import type { DailyContributions } from "./types";

/** Weekend share at or above this makes a "Weekend regular" (an even week is 2/7, about 0.29). */
export const WEEKEND_REGULAR_MIN = 0.35;
/** Monday-Thursday share at or above this makes a "Weekday builder" (an even week is 4/7, about 0.57). */
export const WEEKDAY_BUILDER_MIN = 0.7;

export type WeekArchetype =
  | "Weekend regular"
  | "Weekday builder"
  | "Steady all week";

export type WeekShape = {
  /** Contributions per weekday, Monday first. */
  weekdays: number[];
  total: number;
  /** Saturday + Sunday over total, 0..1. */
  weekendShare: number;
  /** Monday through Thursday over total, 0..1. */
  monThuShare: number;
  /** Null without activity. Describes a habit, never a ranking. */
  archetype: WeekArchetype | null;
};

/**
 * Where the week's contributions fall. The archetype checks the weekend first:
 * weekend share >= 0.35 is "Weekend regular", else Monday-Thursday share >= 0.70
 * is "Weekday builder", else "Steady all week". The two thresholds cannot both
 * hold, so the order never changes a result.
 */
export function weekShape(input: DailyContributions[]): WeekShape {
  const weekdays: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const { date, count } of activeDays(input)) {
    const index = weekdayIndex(date);
    weekdays[index] = (weekdays[index] ?? 0) + count;
  }
  const total = weekdays.reduce((sum, n) => sum + n, 0);
  const share = (indexes: number[]) =>
    total === 0
      ? 0
      : indexes.reduce((sum, i) => sum + (weekdays[i] ?? 0), 0) / total;
  const weekendShare = share([5, 6]);
  const monThuShare = share([0, 1, 2, 3]);

  let archetype: WeekArchetype | null = null;
  if (total > 0) {
    archetype =
      weekendShare >= WEEKEND_REGULAR_MIN
        ? "Weekend regular"
        : monThuShare >= WEEKDAY_BUILDER_MIN
          ? "Weekday builder"
          : "Steady all week";
  }
  return { weekdays, total, weekendShare, monThuShare, archetype };
}
