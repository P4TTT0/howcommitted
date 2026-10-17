export type UserProfile = {
  login: string;
  name: string | null;
  avatarUrl: string;
  createdAt: string;
  /** Years with contributions, newest first, as reported by GitHub. */
  contributionYears: number[];
};

/** One commit contribution entry: commits made to one repository on one day. */
export type CommitContribution = {
  occurredAt: string;
  commitCount: number;
};

/** True commits per day, summed across repositories. `date` is YYYY-MM-DD (UTC). */
export type DailyCommits = {
  date: string;
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

export type CommitReconciliation = {
  summed: number;
  official: number;
  difference: number;
  matches: boolean;
};

export type YearSummary = {
  year: number;
  /** Official totals. `totals.commits` is the number to show when reconciliation fails. */
  totals: YearTotals;
  /**
   * True commits per day. Can be under-counted when GitHub truncates the
   * per-repository data (more than 100 repositories, or 100 entries per repo);
   * `reconciliation` flags that case.
   */
  dailyCommits: DailyCommits[];
  reconciliation: CommitReconciliation;
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
