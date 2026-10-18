import type { YearTotals } from "./types";

export type RoleMix = {
  year: number;
  commits: number;
  pullRequests: number;
  reviews: number;
  issues: number;
};

/**
 * Per year, the share of commits, pull requests, reviews and issues, from the
 * official yearly totals. Each year's four shares add up to 1, or are all 0
 * when the year has none of them. Private contributions are not a role and are
 * left out. Oldest year first.
 */
export function roleMix(
  years: { year: number; totals: YearTotals }[],
): RoleMix[] {
  return years
    .map(({ year, totals }) => {
      const sum =
        totals.commits + totals.pullRequests + totals.reviews + totals.issues;
      const share = (n: number) => (sum === 0 ? 0 : n / sum);
      return {
        year,
        commits: share(totals.commits),
        pullRequests: share(totals.pullRequests),
        reviews: share(totals.reviews),
        issues: share(totals.issues),
      };
    })
    .sort((a, b) => a.year - b.year);
}
