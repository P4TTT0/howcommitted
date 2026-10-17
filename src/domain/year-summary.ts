import {
  reconcileCommits,
  sumDailyCommits,
  totalCommits,
} from "./daily-commits";
import type {
  CalendarDay,
  CommitContribution,
  YearSummary,
  YearTotals,
} from "./types";

export type RawYear = {
  year: number;
  totals: YearTotals;
  commitContributionsByRepo: CommitContribution[][];
  calendar: CalendarDay[];
};

export function buildYearSummary(raw: RawYear): YearSummary {
  const dailyCommits = sumDailyCommits(raw.commitContributionsByRepo);
  return {
    year: raw.year,
    totals: raw.totals,
    dailyCommits,
    reconciliation: reconcileCommits(
      totalCommits(dailyCommits),
      raw.totals.commits,
    ),
    calendar: raw.calendar,
  };
}

export type YearBlock = {
  year: number;
  commits: number;
};

/** One block per year, oldest first. Height = official commit total. */
export function yearBlocks(years: YearSummary[]): YearBlock[] {
  return years
    .map(({ year, totals }) => ({ year, commits: totals.commits }))
    .sort((a, b) => a.year - b.year);
}
