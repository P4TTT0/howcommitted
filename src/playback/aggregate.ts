/**
 * Pure aggregation helpers. Playback never reacts to raw commits: daily
 * counts are folded into weeks (and later into grid slots) first.
 *
 * Dates are ISO calendar days ("2024-03-09") treated as UTC, so the helpers
 * are independent of the machine time zone.
 */

import type { DailyCommits } from "@/domain/types";

/** Commits in one week. `week` counts 7-day buckets from the first day. */
export type WeeklyCommits = { week: number; count: number };

export type YearSpan = {
  year: number;
  /** Progress (0..1) through the whole range at which the year begins. */
  startProgress: number;
};

const MS_PER_DAY = 86_400_000;

export function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY);
}

/** Number of 7-day buckets needed to cover the range. 0 for no data. */
export function weekSpan(days: readonly DailyCommits[]): number {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return 0;
  return Math.floor((dayNumber(last.date) - dayNumber(first.date)) / 7) + 1;
}

/** Folds daily counts into weeks. Weeks without commits are omitted. */
export function aggregateWeekly(
  days: readonly DailyCommits[],
): WeeklyCommits[] {
  const first = days[0];
  if (!first) return [];
  const origin = dayNumber(first.date);
  const weeks = new Map<number, number>();
  for (const { date, commits } of days) {
    if (commits <= 0) continue;
    const week = Math.floor((dayNumber(date) - origin) / 7);
    weeks.set(week, (weeks.get(week) ?? 0) + commits);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, count]) => ({ week, count }));
}

/** Running total after each day, in input order. */
export function cumulativeByDay(days: readonly DailyCommits[]): number[] {
  let total = 0;
  return days.map(({ commits }) => {
    total += Math.max(0, commits);
    return total;
  });
}

/**
 * Running total at a progress through the range, interpolated linearly
 * inside each day so counters move smoothly instead of in daily jumps.
 */
export function cumulativeAt(
  cumulative: readonly number[],
  progress: number,
): number {
  const count = cumulative.length;
  if (count === 0) return 0;
  const x = Math.min(1, Math.max(0, progress)) * count;
  const index = Math.min(count - 1, Math.floor(x));
  const before = index > 0 ? (cumulative[index - 1] ?? 0) : 0;
  const after = cumulative[index] ?? before;
  return before + (after - before) * (x - index);
}

/** First day of each calendar year present in the data. */
export function yearSpans(days: readonly DailyCommits[]): YearSpan[] {
  const spans: YearSpan[] = [];
  days.forEach(({ date }, index) => {
    const year = Number(date.slice(0, 4));
    if (spans[spans.length - 1]?.year !== year) {
      spans.push({ year, startProgress: index / days.length });
    }
  });
  return spans;
}

/** The year in effect at a progress through the range. */
export function yearAt(spans: readonly YearSpan[], progress: number): number {
  let current = spans[0]?.year ?? 0;
  for (const span of spans) {
    if (span.startProgress > progress) break;
    current = span.year;
  }
  return current;
}
