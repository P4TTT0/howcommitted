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

/**
 * Merges per-window entries of the same repo into yearly totals, sorted by
 * repo. Quarter windows never share a date, so day counts add up exactly.
 */
export function mergeRepoCommits(
  entries: { repo: string; nodes: CommitContribution[] }[],
): RepoCommits[] {
  const byRepo = new Map<string, RepoCommits>();
  for (const { repo, nodes } of entries) {
    const total = byRepo.get(repo) ?? { repo, commits: 0, days: 0 };
    for (const { commitCount } of nodes) {
      if (commitCount <= 0) continue;
      total.commits += commitCount;
      total.days += 1;
    }
    byRepo.set(repo, total);
  }
  return [...byRepo.values()]
    .filter((r) => r.commits > 0)
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
