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
  const byRepo = new Map<string, MainRepo>();
  for (const { year, repoCommits } of years) {
    for (const { repo, commits, days } of repoCommits) {
      if (commits <= 0) continue;
      const entry = byRepo.get(repo);
      // Days are distinct within a year and years never overlap, so they add up.
      byRepo.set(repo, {
        repo,
        commits: (entry?.commits ?? 0) + commits,
        days: (entry?.days ?? 0) + days,
        firstYear: Math.min(entry?.firstYear ?? year, year),
        lastYear: Math.max(entry?.lastYear ?? year, year),
      });
    }
  }
  return [...byRepo.values()].sort(rankCompare);
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
      const [top] = [...repoCommits]
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
