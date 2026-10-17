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

/**
 * Every year from `firstYear` to `lastYear`, oldest first. A year with no
 * block (nothing fetched, nothing contributed) is an explicit zero so the
 * position of a year never shifts and its color identity stays stable.
 */
export function yearBlocksInRange(
  blocks: readonly YearBlock[],
  firstYear: number,
  lastYear: number,
): YearBlock[] {
  const byYear = new Map(blocks.map((block) => [block.year, block]));
  const length = Math.max(0, lastYear - firstYear + 1);
  return Array.from({ length }, (_, index) => {
    const year = firstYear + index;
    return { year, contributions: byYear.get(year)?.contributions ?? 0 };
  });
}
