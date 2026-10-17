import type { Repo } from "./types";

export type RepoFlag = {
  name: string;
  createdAt: string;
  stars: number;
  reason: "first" | "notable";
};

export const NOTABLE_MIN_STARS = 10;
export const MAX_REPO_FLAGS = 8;

/**
 * Repo-creation flags for the cumulative line: the first repo plus the most
 * starred ones (at least NOTABLE_MIN_STARS), capped, oldest first.
 * Expects non-fork repos; forks are excluded by the query.
 */
export function repoCreationFlags(
  repos: Repo[],
  cap: number = MAX_REPO_FLAGS,
): RepoFlag[] {
  if (cap <= 0) return [];
  const byDate = [...repos].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const first = byDate[0];
  if (!first) return [];

  const notable = byDate
    .slice(1)
    .filter((repo) => repo.stars >= NOTABLE_MIN_STARS)
    .sort((a, b) => b.stars - a.stars || a.createdAt.localeCompare(b.createdAt))
    .slice(0, cap - 1);

  return [
    toFlag(first, "first"),
    ...notable.map((r) => toFlag(r, "notable")),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function toFlag(repo: Repo, reason: RepoFlag["reason"]): RepoFlag {
  return {
    name: repo.name,
    createdAt: repo.createdAt,
    stars: repo.stars,
    reason,
  };
}
