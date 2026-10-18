import {
  activeDays,
  addDays,
  daysBetween,
  isoWeekStart,
  toCalendarDays,
} from "./activity";
import { longestStreak, type Streak } from "./streaks";
import type { DailyContributions } from "./types";

export type QuietStretch = {
  /** Days without any contribution between two active days. */
  length: number;
  start: string;
  end: string;
  /** The first active day after the stretch. */
  comeback: string;
};

export type YourDate = {
  /** MM-DD. */
  monthDay: string;
  /** Distinct years with a contribution on that MM-DD. */
  years: number;
  /** Years from the first to the last active year, inclusive. */
  totalYears: number;
};

export type Records = {
  longestStreak: Streak;
  busiestDay: { count: number; date: string } | null;
  /** Contributions divided by active days; 0 without activity. */
  averagePerActiveDay: number;
  activeDays: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Longest gap between two active days. Null with fewer than two active days or no gap. */
  longestQuiet: QuietStretch | null;
  /** ISO week, Monday to Sunday. */
  busiestWeek: { count: number; start: string; end: string } | null;
  /** YYYY-MM. */
  busiestMonth: { count: number; month: string } | null;
  busiestYear: { count: number; year: number } | null;
  yourDate: YourDate | null;
};

/** Sums counts per key and returns the largest; ties go to the smallest key. */
function maxBucket(
  days: DailyContributions[],
  keyOf: (date: string) => string,
): { key: string; count: number } | null {
  const sums = new Map<string, number>();
  for (const { date, count } of days) {
    const key = keyOf(date);
    sums.set(key, (sums.get(key) ?? 0) + count);
  }
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of sums) {
    if (!best || count > best.count || (count === best.count && key < best.key))
      best = { key, count };
  }
  return best;
}

function longestQuiet(days: DailyContributions[]): QuietStretch | null {
  let best: QuietStretch | null = null;
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const next = days[i];
    if (!prev || !next) continue;
    const length = daysBetween(prev.date, next.date) - 1;
    // Strict ">" keeps the earliest stretch on ties.
    if (length > 0 && (!best || length > best.length)) {
      best = {
        length,
        start: addDays(prev.date, 1),
        end: addDays(next.date, -1),
        comeback: next.date,
      };
    }
  }
  return best;
}

/**
 * The MM-DD with a contribution in the most distinct years. Ties go to the
 * date whose latest active year is most recent, then to the earliest MM-DD.
 */
function yourDate(days: DailyContributions[]): YourDate | null {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return null;
  const years = new Map<string, Set<string>>();
  for (const { date } of days) {
    const monthDay = date.slice(5);
    const set = years.get(monthDay) ?? new Set<string>();
    set.add(date.slice(0, 4));
    years.set(monthDay, set);
  }
  let best: { monthDay: string; years: number; last: string } | null = null;
  for (const [monthDay, set] of years) {
    const last = [...set].sort().at(-1) as string;
    const candidate = { monthDay, years: set.size, last };
    if (
      !best ||
      candidate.years > best.years ||
      (candidate.years === best.years && candidate.last > best.last) ||
      (candidate.years === best.years &&
        candidate.last === best.last &&
        candidate.monthDay < best.monthDay)
    )
      best = candidate;
  }
  if (!best) return null;
  const firstYear = Number(first.date.slice(0, 4));
  const lastYear = Number(last.date.slice(0, 4));
  return {
    monthDay: best.monthDay,
    years: best.years,
    totalYears: lastYear - firstYear + 1,
  };
}

/**
 * Habit records over daily contributions (all types). Dates are UTC. Ties on a
 * "busiest" record go to the earliest period.
 */
export function records(input: DailyContributions[]): Records {
  const days = activeDays(input);
  const total = days.reduce((sum, day) => sum + day.count, 0);

  let busiestDay: Records["busiestDay"] = null;
  for (const { date, count } of days) {
    if (!busiestDay || count > busiestDay.count) busiestDay = { count, date };
  }

  const week = maxBucket(days, isoWeekStart);
  const month = maxBucket(days, (date) => date.slice(0, 7));
  const year = maxBucket(days, (date) => date.slice(0, 4));

  return {
    longestStreak: longestStreak(toCalendarDays(days)),
    busiestDay,
    averagePerActiveDay: days.length === 0 ? 0 : total / days.length,
    activeDays: days.length,
    firstDate: days[0]?.date ?? null,
    lastDate: days.at(-1)?.date ?? null,
    longestQuiet: longestQuiet(days),
    busiestWeek: week && {
      count: week.count,
      start: week.key,
      end: addDays(week.key, 6),
    },
    busiestMonth: month && { count: month.count, month: month.key },
    busiestYear: year && { count: year.count, year: Number(year.key) },
    yourDate: yourDate(days),
  };
}
