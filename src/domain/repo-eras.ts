import type { Repo, RepoCommits } from "./types";

export type MainRepo = {
  /** `owner/name`, a public repository. */
  repo: string;
  commits: number;
  /** Days with at least one commit to it. */
  days: number;
  firstYear: number;
  lastYear: number;
};

export type RepoEra = {
  year: number;
  repo: string;
  commits: number;
  /** Top language of the repo, only when the user owns it. */
  language?: string;
};

type YearRepos = { year: number; repoCommits: RepoCommits[] };

const TOP_REPOS = 5;

function sumCommits(repo: RepoCommits): number {
  return repo.days.reduce((sum, d) => sum + d.count, 0);
}

/** More commits first, then more days, then name, so ties are deterministic. */
function rankCompare(
  a: { repo: string; commits: number; days: number },
  b: { repo: string; commits: number; days: number },
): number {
  return (
    b.commits - a.commits || b.days - a.days || a.repo.localeCompare(b.repo)
  );
}

/** Commits to public repositories across all years, most commits first. */
function rankRepos(years: YearRepos[]): MainRepo[] {
  const byRepo = new Map<
    string,
    { commits: number; dates: Set<string>; years: number[] }
  >();
  for (const { year, repoCommits } of years) {
    for (const repo of repoCommits) {
      const entry = byRepo.get(repo.repo) ?? {
        commits: 0,
        dates: new Set<string>(),
        years: [],
      };
      entry.commits += sumCommits(repo);
      for (const d of repo.days) entry.dates.add(d.date);
      entry.years.push(year);
      byRepo.set(repo.repo, entry);
    }
  }
  return [...byRepo]
    .map(([repo, e]) => ({
      repo,
      commits: e.commits,
      days: e.dates.size,
      firstYear: Math.min(...e.years),
      lastYear: Math.max(...e.years),
    }))
    .filter((r) => r.commits > 0)
    .sort(rankCompare);
}

/** The public repository with the most commits, or null without any. */
export function mainRepo(years: YearRepos[]): MainRepo | null {
  return rankRepos(years)[0] ?? null;
}

/** The top public repositories by commits (5 by default). */
export function topRepos(years: YearRepos[], limit = TOP_REPOS): MainRepo[] {
  return rankRepos(years).slice(0, limit);
}

function topLanguage(repo: Repo): string | undefined {
  return [...repo.languages].sort(
    (a, b) => b.size - a.size || a.name.localeCompare(b.name),
  )[0]?.name;
}

/**
 * Per year, the public repository with the most commits that year. The
 * language comes from the owned repos already fetched: it is set only when
 * `repo` is `login/name` and that name is in `repos`, otherwise it is omitted.
 * Years without public commits are skipped. Oldest year first.
 */
export function eras(
  years: YearRepos[],
  repos: Repo[],
  login: string,
): RepoEra[] {
  const owned = new Map(repos.map((r) => [r.name, r]));
  const prefix = `${login.toLowerCase()}/`;
  return [...years]
    .sort((a, b) => a.year - b.year)
    .flatMap(({ year, repoCommits }) => {
      const [top] = repoCommits
        .map((r) => ({
          repo: r.repo,
          commits: sumCommits(r),
          days: r.days.length,
        }))
        .filter((r) => r.commits > 0)
        .sort(rankCompare);
      if (!top) return [];
      const isOwned = top.repo.toLowerCase().startsWith(prefix);
      const ownedRepo = isOwned
        ? owned.get(top.repo.slice(prefix.length))
        : undefined;
      const language = ownedRepo && topLanguage(ownedRepo);
      return [
        {
          year,
          repo: top.repo,
          commits: top.commits,
          ...(language ? { language } : {}),
        },
      ];
    });
}
