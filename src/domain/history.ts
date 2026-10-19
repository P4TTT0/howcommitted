import { buildHeatmap, type HeatmapCell } from "./heatmap";
import { type LanguageShare, languageShares } from "./languages";
import { type RepoFlag, repoCreationFlags } from "./repo-flags";
import { longestStreak, type Streak } from "./streaks";
import type {
  DailyContributions,
  ProfileData,
  RepoCommits,
  UserProfile,
  YearTotals,
} from "./types";
import { type YearBlock, yearBlocks } from "./year-summary";

export type HistoryYear = {
  year: number;
  totals: YearTotals;
  /** Commits to public repositories, per repository. Private repositories are never listed. */
  repoCommits: RepoCommits[];
  /** Calendar contributions per day (all types, public and shared private). Days with none are omitted. */
  dailyContributions: DailyContributions[];
  /** The calendar's total for the year: the number the experience shows. */
  totalContributions: number;
  /** Contribution calendar grid. These are contributions of all types, not commits. */
  heatmap: HeatmapCell[];
};

/** Public shape of the history API response. */
export type History = {
  user: Pick<UserProfile, "login" | "name" | "avatarUrl" | "createdAt">;
  /** Oldest first. */
  years: HistoryYear[];
  yearBlocks: YearBlock[];
  /** Sums of the official yearly totals (commits, PRs, reviews, issues, private). */
  totals: YearTotals;
  /** Sum of the yearly calendar totals. */
  totalContributions: number;
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
      repoCommits: year.repoCommits,
      dailyContributions: year.calendar
        .filter((day) => day.count > 0)
        .map((day) => ({ date: day.date, count: day.count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      totalContributions: year.totalContributions,
      heatmap: buildHeatmap(year.calendar),
    })),
    yearBlocks: yearBlocks(years),
    totals,
    totalContributions: years.reduce(
      (sum, year) => sum + year.totalContributions,
      0,
    ),
    longestStreak: longestStreak(years.flatMap((year) => year.calendar)),
    languages: languageShares(repos),
    repoFlags: repoCreationFlags(repos),
  };
}
