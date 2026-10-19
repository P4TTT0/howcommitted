import type {
  CalendarDay,
  RepoCommits,
  YearSummary,
  YearTotals,
} from "./types";

export type RawYear = {
  year: number;
  totals: YearTotals;
  /**
   * Commits of public repositories only (`repo` is `owner/name`), one entry per
   * repository for the year.
   */
  publicRepoContributions: { repo: string; commits: number }[];
  calendar: CalendarDay[];
  totalContributions: number;
};

/** Yearly commits per repo, without empty repos, sorted by repo. */
export function mergeRepoCommits(
  entries: { repo: string; commits: number }[],
): RepoCommits[] {
  const byRepo = new Map<string, RepoCommits>();
  for (const { repo, commits } of entries) {
    if (commits <= 0) continue;
    const total = byRepo.get(repo) ?? { repo, commits: 0 };
    total.commits += commits;
    byRepo.set(repo, total);
  }
  return [...byRepo.values()].sort((a, b) => a.repo.localeCompare(b.repo));
}

export function buildYearSummary(raw: RawYear): YearSummary {
  return {
    year: raw.year,
    totals: raw.totals,
    repoCommits: mergeRepoCommits(raw.publicRepoContributions),
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
