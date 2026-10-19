export type UserProfile = {
  login: string;
  name: string | null;
  avatarUrl: string;
  createdAt: string;
  /** Years with contributions, newest first, as reported by GitHub. */
  contributionYears: number[];
};

/** True commits per day, summed across repositories. `date` is YYYY-MM-DD (UTC). */
export type DailyCommits = {
  date: string;
  commits: number;
};

/**
 * Commits to one public repository in one year. `repo` is `owner/name`.
 * Private repositories never appear here: their names must not reach the
 * cache or the browser, so private work stays an aggregate count only.
 */
export type RepoCommits = {
  repo: string;
  commits: number;
};

/** Contributions of one day from the GitHub calendar (all types, public and shared private). */
export type DailyContributions = {
  date: string;
  count: number;
};

/** One contribution calendar day. Counts ALL contribution types, never only commits. */
export type CalendarDay = {
  date: string;
  count: number;
  /** 0 = Sunday ... 6 = Saturday, as in the GitHub calendar. */
  weekday: number;
};

export type YearTotals = {
  commits: number;
  pullRequests: number;
  reviews: number;
  issues: number;
  /** Private contributions the user chose to share, as a count only (no dates). */
  privateContributions: number;
};

export type YearSummary = {
  year: number;
  /** Official totals. `totals.commits` is the number to show for the year. */
  totals: YearTotals;
  /**
   * Commits to public repositories, per repository. Sorted by repo name. GitHub
   * returns at most 100 repositories per year, so a repo outside that top 100
   * is missing here.
   */
  repoCommits: RepoCommits[];
  calendar: CalendarDay[];
  /** The calendar's own total for the year (all contribution types, public and shared private). */
  totalContributions: number;
};

export type LanguageSize = {
  name: string;
  size: number;
};

export type Repo = {
  name: string;
  createdAt: string;
  stars: number;
  languages: LanguageSize[];
};

/** Everything fetched for one user: the cache and the pure metrics both work on this. */
export type ProfileData = {
  user: UserProfile;
  /** Oldest first. */
  years: YearSummary[];
  repos: Repo[];
};
