import {
  reconcileCommits,
  sumDailyCommits,
  totalCommits,
} from "./daily-commits";
import type {
  CalendarDay,
  CommitContribution,
  RepoCommits,
  YearSummary,
  YearTotals,
} from "./types";

export type RawYear = {
  year: number;
  totals: YearTotals;
  commitContributionsByRepo: CommitContribution[][];
  /**
   * Commit contributions of public repositories only (`repo` is `owner/name`).
   * The same repo may appear once per quarter window; they are merged.
   */
  publicRepoContributions: { repo: string; nodes: CommitContribution[] }[];
  calendar: CalendarDay[];
  totalContributions: number;
};

/** Merges per-window entries of the same repo into per-day counts, sorted by repo then date. */
export function mergeRepoCommits(
  entries: { repo: string; nodes: CommitContribution[] }[],
): RepoCommits[] {
  const byRepo = new Map<string, Map<string, number>>();
  for (const { repo, nodes } of entries) {
    const days = byRepo.get(repo) ?? new Map<string, number>();
    for (const { occurredAt, commitCount } of nodes) {
      if (commitCount <= 0) continue;
      const date = occurredAt.slice(0, 10);
      days.set(date, (days.get(date) ?? 0) + commitCount);
    }
    byRepo.set(repo, days);
  }
  return [...byRepo]
    .filter(([, days]) => days.size > 0)
    .map(([repo, days]) => ({
      repo,
      days: [...days]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.repo.localeCompare(b.repo));
}

export function buildYearSummary(raw: RawYear): YearSummary {
  const dailyCommits = sumDailyCommits(raw.commitContributionsByRepo);
  return {
    year: raw.year,
    totals: raw.totals,
    dailyCommits,
    repoCommits: mergeRepoCommits(raw.publicRepoContributions),
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
