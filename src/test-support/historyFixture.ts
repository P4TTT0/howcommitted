import type { History, HistoryYear } from "@/domain/history";
import type { DailyCommits } from "@/domain/types";

/**
 * Small deterministic histories for tests (unit and e2e). They only need to
 * look like the history API payload, not like any real profile.
 */

/** `commits` on every `every`-th day of the year, starting on Jan 1. */
export function steadyDays(
  year: number,
  commits: number,
  every = 3,
): DailyCommits[] {
  const days: DailyCommits[] = [];
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1), n = 0; ms <= end; ms += 86_400_000, n++) {
    if (n % every === 0) {
      days.push({ date: new Date(ms).toISOString().slice(0, 10), commits });
    }
  }
  return days;
}

export function makeYear(
  year: number,
  dailyCommits: DailyCommits[],
  official?: number,
): HistoryYear {
  const summed = dailyCommits.reduce((sum, day) => sum + day.commits, 0);
  const commits = official ?? summed;
  return {
    year,
    totals: {
      commits,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      privateContributions: 0,
    },
    dailyCommits,
    reconciliation: {
      summed,
      official: commits,
      difference: commits - summed,
      matches: summed === commits,
    },
    heatmap: [],
  };
}

export function makeHistory(
  login: string,
  years: HistoryYear[],
  createdAt = `${years[0]?.year ?? 2020}-01-01T00:00:00Z`,
): History {
  const commits = years.reduce((sum, year) => sum + year.totals.commits, 0);
  return {
    user: { login, name: null, avatarUrl: "", createdAt },
    years,
    yearBlocks: years.map((year) => ({
      year: year.year,
      commits: year.totals.commits,
    })),
    totals: {
      commits,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      privateContributions: 0,
    },
    longestStreak: { length: 0, start: null, end: null },
    languages: [],
    repoFlags: [],
  };
}
