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
  totalContributions: number;
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
    totalContributions: raw.totalContributions,
  };
}

export type YearBlock = {
  year: number;
  contributions: number;
};

/** One block per year, oldest first. Height = the calendar total of the year. */
export function yearBlocks(years: YearSummary[]): YearBlock[] {
  return years
    .map(({ year, totalContributions }) => ({
      year,
      contributions: totalContributions,
    }))
    .sort((a, b) => a.year - b.year);
}
