import type { CalendarDay } from "./types";

export type Streak = {
  length: number;
  start: string | null;
  end: string | null;
};

const DAY_MS = 86_400_000;

/**
 * Longest run of consecutive days with at least one contribution (any type),
 * computed from contribution calendar days. Days may span several years and
 * may repeat across year boundaries. Ties keep the earliest run.
 */
export function longestStreak(days: CalendarDay[]): Streak {
  // Adjacent yearly calendars can both include the boundary day: dedupe by date.
  const active = [
    ...new Set(days.filter((day) => day.count > 0).map((day) => day.date)),
  ].sort();

  let best: Streak = { length: 0, start: null, end: null };
  let runStart: string | null = null;
  let previous: string | null = null;
  let length = 0;

  for (const date of active) {
    const continues =
      previous !== null &&
      Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) ===
        DAY_MS;
    if (continues) {
      length += 1;
    } else {
      runStart = date;
      length = 1;
    }
    if (length > best.length) best = { length, start: runStart, end: date };
    previous = date;
  }
  return best;
}
