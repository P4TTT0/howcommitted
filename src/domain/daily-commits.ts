import type {
  CommitContribution,
  CommitReconciliation,
  DailyCommits,
} from "./types";

/** Sums commits per UTC day across repositories. Result is sorted by date. */
export function sumDailyCommits(
  perRepo: CommitContribution[][],
): DailyCommits[] {
  const byDate = new Map<string, number>();
  for (const contributions of perRepo) {
    for (const { occurredAt, commitCount } of contributions) {
      if (commitCount <= 0) continue;
      const date = occurredAt.slice(0, 10);
      byDate.set(date, (byDate.get(date) ?? 0) + commitCount);
    }
  }
  return [...byDate]
    .map(([date, commits]) => ({ date, commits }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function totalCommits(days: DailyCommits[]): number {
  return days.reduce((sum, day) => sum + day.commits, 0);
}

/**
 * Compares summed daily commits with the official GitHub total. A mismatch
 * (for example more than 100 repositories in a year) means the summed days are
 * incomplete: show the official total with a notice.
 */
export function reconcileCommits(
  summed: number,
  official: number,
): CommitReconciliation {
  return {
    summed,
    official,
    difference: official - summed,
    matches: summed === official,
  };
}
