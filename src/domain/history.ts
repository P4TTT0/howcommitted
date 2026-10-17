import { buildHeatmap, type HeatmapCell } from "./heatmap";
import { type LanguageShare, languageShares } from "./languages";
import { type RepoFlag, repoCreationFlags } from "./repo-flags";
import { longestStreak, type Streak } from "./streaks";
import type {
  CommitReconciliation,
  DailyCommits,
  ProfileData,
  UserProfile,
  YearTotals,
} from "./types";
import { type YearBlock, yearBlocks } from "./year-summary";

export type HistoryYear = {
  year: number;
  totals: YearTotals;
  /** True commits per day. May be incomplete when `reconciliation.matches` is false. */
  dailyCommits: DailyCommits[];
  reconciliation: CommitReconciliation;
  /** Contribution calendar grid. These are contributions of all types, not commits. */
  heatmap: HeatmapCell[];
};

/** Public shape of the history API response. */
export type History = {
  user: Pick<UserProfile, "login" | "name" | "avatarUrl" | "createdAt">;
  /** Oldest first. */
  years: HistoryYear[];
  yearBlocks: YearBlock[];
  /** Sums of the official yearly totals. */
  totals: YearTotals;
  /** Longest run of days with any contribution (not only commits). */
  longestStreak: Streak;
  /** Languages of owned non-fork repos by bytes, not per commit. */
  languages: LanguageShare[];
  repoFlags: RepoFlag[];
};

const ZERO_TOTALS: YearTotals = {
  commits: 0,
  pullRequests: 0,
  reviews: 0,
  issues: 0,
  privateContributions: 0,
};

export function buildHistory({ user, years, repos }: ProfileData): History {
  const totals = years.reduce<YearTotals>(
    (sum, year) => ({
      commits: sum.commits + year.totals.commits,
      pullRequests: sum.pullRequests + year.totals.pullRequests,
      reviews: sum.reviews + year.totals.reviews,
      issues: sum.issues + year.totals.issues,
      privateContributions:
        sum.privateContributions + year.totals.privateContributions,
    }),
    ZERO_TOTALS,
  );

  return {
    user: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    years: years.map((year) => ({
      year: year.year,
      totals: year.totals,
      dailyCommits: year.dailyCommits,
      reconciliation: year.reconciliation,
      heatmap: buildHeatmap(year.calendar),
    })),
    yearBlocks: yearBlocks(years),
    totals,
    longestStreak: longestStreak(years.flatMap((year) => year.calendar)),
    languages: languageShares(repos),
    repoFlags: repoCreationFlags(repos),
  };
}
