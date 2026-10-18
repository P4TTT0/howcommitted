import type { CalendarDay, DailyContributions } from "./types";

const DAY_MS = 86_400_000;

const toMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/**
 * Days with at least one contribution, one entry per date (the larger count
 * wins when adjacent yearly calendars repeat a boundary day), sorted by date.
 */
export function activeDays(days: DailyContributions[]): DailyContributions[] {
  const byDate = new Map<string, number>();
  for (const { date, count } of days) {
    if (count > 0) byDate.set(date, Math.max(byDate.get(date) ?? 0, count));
  }
  return [...byDate]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Weekday index with Monday first: 0 = Monday ... 6 = Sunday (UTC). */
export function weekdayIndex(date: string): number {
  return (new Date(toMs(date)).getUTCDay() + 6) % 7;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(toMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday of the ISO week containing `date`. */
export function isoWeekStart(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

/** Adapts daily contributions to the calendar shape `longestStreak` expects. */
export function toCalendarDays(days: DailyContributions[]): CalendarDay[] {
  return days.map(({ date, count }) => ({
    date,
    count,
    weekday: new Date(toMs(date)).getUTCDay(),
  }));
}
