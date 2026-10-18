import { buildHeatmap } from "@/domain/heatmap";
import type { History, HistoryYear } from "@/domain/history";
import type { CalendarDay, DailyContributions } from "@/domain/types";

/**
 * Small deterministic histories for tests (unit and e2e). They only need to
 * look like the history API payload, not like any real profile.
 */

/** `count` contributions on every `every`-th day of the year, starting on Jan 1. */
export function steadyDays(
  year: number,
  count: number,
  every = 3,
): DailyContributions[] {
  const days: DailyContributions[] = [];
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1), n = 0; ms <= end; ms += 86_400_000, n++) {
    if (n % every === 0) {
      days.push({ date: new Date(ms).toISOString().slice(0, 10), count });
    }
  }
  return days;
}

/** Every day of the year as the GitHub calendar lists it, quiet days as zeros. */
function calendarOf(year: number, days: DailyContributions[]): CalendarDay[] {
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const calendar: CalendarDay[] = [];
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1); ms <= end; ms += 86_400_000) {
    const date = new Date(ms).toISOString().slice(0, 10);
    calendar.push({
      date,
      count: counts.get(date) ?? 0,
      weekday: new Date(ms).getUTCDay(),
    });
  }
  return calendar;
}

export type YearOptions = {
  /** The calendar total; defaults to the sum of the days. */
  official?: number;
  /** Public commits of the year; defaults to 0 (a private-only year). */
  commits?: number;
  /** Private contributions included in the calendar; defaults to 0. */
  privateContributions?: number;
};

export function makeYear(
  year: number,
  dailyContributions: DailyContributions[],
  official?: number | YearOptions,
): HistoryYear {
  const options =
    typeof official === "number" ? { official } : (official ?? {});
  const summed = dailyContributions.reduce((sum, day) => sum + day.count, 0);
  const total = options.official ?? summed;
  const commits = options.commits ?? 0;
  return {
    year,
    totals: {
      commits,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      privateContributions: options.privateContributions ?? 0,
    },
    dailyCommits: [],
    repoCommits: [],
    reconciliation: {
      summed: 0,
      official: commits,
      difference: commits,
      matches: commits === 0,
    },
    dailyContributions,
    totalContributions: total,
    heatmap: buildHeatmap(calendarOf(year, dailyContributions)),
  };
}

export function makeHistory(
  login: string,
  years: HistoryYear[],
  createdAt = `${years[0]?.year ?? 2020}-01-01T00:00:00Z`,
): History {
  const sumOf = (pick: (year: HistoryYear) => number) =>
    years.reduce((sum, year) => sum + pick(year), 0);
  return {
    user: { login, name: null, avatarUrl: "", createdAt },
    years,
    yearBlocks: years.map((year) => ({
      year: year.year,
      contributions: year.totalContributions,
    })),
    totals: {
      commits: sumOf((year) => year.totals.commits),
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      privateContributions: sumOf((year) => year.totals.privateContributions),
    },
    totalContributions: sumOf((year) => year.totalContributions),
    longestStreak: { length: 0, start: null, end: null },
    languages: [],
    repoFlags: [],
  };
}
