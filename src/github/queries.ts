import "server-only";
import type { Repo, UserProfile, YearSummary } from "@/domain/types";
import { buildYearSummary } from "@/domain/year-summary";
import {
  type GraphqlResult,
  githubGraphql,
  RATE_LIMIT_FIELDS,
  type RateLimitInfo,
} from "./graphql";

/** Safety cap on repository pages (100 repos each). */
export const MAX_REPO_PAGES = 10;

const PREVIEW_QUERY = `
query Preview($login: String!) {
  ${RATE_LIMIT_FIELDS}
  user(login: $login) {
    login
    name
    avatarUrl
    createdAt
    contributionsCollection { contributionYears }
  }
}`;

/**
 * One request per year, with only the fields the experience reads. Per-repo
 * commits come from `contributions { totalCount }`: day-level nodes (up to 100
 * per repo) made heavy profiles exceed GitHub's 10 s limit. `maxRepositories`
 * caps at 100, so a repo outside the year's top 100 is not counted per repo.
 */
export const YEAR_QUERY = `
query Year($login: String!, $from: DateTime!, $to: DateTime!) {
  ${RATE_LIMIT_FIELDS}
  user(login: $login) {
    year: contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount weekday } }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner isPrivate visibility }
        contributions { totalCount }
      }
    }
  }
}`;

const REPOS_QUERY = `
query Repos($login: String!, $after: String) {
  ${RATE_LIMIT_FIELDS}
  user(login: $login) {
    repositories(
      ownerAffiliations: OWNER
      isFork: false
      privacy: PUBLIC
      orderBy: { field: CREATED_AT, direction: ASC }
      first: 100
      after: $after
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        createdAt
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
  }
}`;

type PreviewData = {
  user: {
    login: string;
    name: string | null;
    avatarUrl: string;
    createdAt: string;
    contributionsCollection: { contributionYears: number[] };
  } | null;
};

type YearData = {
  user: {
    year: {
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      totalPullRequestReviewContributions: number;
      totalIssueContributions: number;
      restrictedContributionsCount: number;
      contributionCalendar: {
        totalContributions: number;
        weeks: {
          contributionDays: {
            date: string;
            contributionCount: number;
            weekday: number;
          }[];
        }[];
      };
      commitContributionsByRepository: {
        repository: {
          nameWithOwner: string;
          isPrivate: boolean;
          visibility: string;
        } | null;
        contributions: { totalCount: number };
      }[];
    };
  } | null;
};

type ReposData = {
  user: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ({
        name: string;
        createdAt: string;
        stargazerCount: number;
        languages: {
          edges: { size: number; node: { name: string } }[] | null;
        } | null;
      } | null)[];
    };
  } | null;
};

const NOT_FOUND = { kind: "not_found" } as const;

/** Exact-login lookup. 1 point. */
export async function fetchUserPreview(
  token: string,
  login: string,
  signal?: AbortSignal,
): Promise<GraphqlResult<UserProfile>> {
  const result = await githubGraphql<PreviewData>(
    token,
    PREVIEW_QUERY,
    { login },
    signal,
  );
  if (!result.ok) return result;
  const user = result.data.user;
  if (!user)
    return { ok: false, error: NOT_FOUND, rateLimit: result.rateLimit };
  return {
    ok: true,
    rateLimit: result.rateLimit,
    data: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      contributionYears: user.contributionsCollection.contributionYears,
    },
  };
}

/**
 * One contribution year (GitHub allows spans of at most one year). One request,
 * 1 point.
 */
export async function fetchYear(
  token: string,
  login: string,
  year: number,
  signal?: AbortSignal,
): Promise<GraphqlResult<YearSummary>> {
  const result = await githubGraphql<YearData>(
    token,
    YEAR_QUERY,
    {
      login,
      from: `${year}-01-01T00:00:00Z`,
      to: `${year}-12-31T23:59:59Z`,
    },
    signal,
  );
  if (!result.ok) return result;
  const collection = result.data.user?.year;
  if (!collection) {
    return { ok: false, error: NOT_FOUND, rateLimit: result.rateLimit };
  }
  // Fail closed: a repo is kept only when GitHub says it is PUBLIC and not
  // private. Anything else (null, missing fields, INTERNAL) is dropped here,
  // before anything is cached.
  const publicRepoContributions =
    collection.commitContributionsByRepository.flatMap((entry) =>
      entry.repository?.visibility === "PUBLIC" &&
      entry.repository.isPrivate === false
        ? [
            {
              repo: entry.repository.nameWithOwner,
              commits: entry.contributions.totalCount,
            },
          ]
        : [],
    );
  return {
    ok: true,
    rateLimit: result.rateLimit,
    data: buildYearSummary({
      year,
      totals: {
        commits: collection.totalCommitContributions,
        pullRequests: collection.totalPullRequestContributions,
        reviews: collection.totalPullRequestReviewContributions,
        issues: collection.totalIssueContributions,
        privateContributions: collection.restrictedContributionsCount,
      },
      publicRepoContributions,
      totalContributions: collection.contributionCalendar.totalContributions,
      // Defensive: weeks at the edges can pad with days of the neighbouring
      // years. Only days of the requested year belong to this year.
      calendar: collection.contributionCalendar.weeks.flatMap((week) =>
        week.contributionDays
          .filter((d) => d.date.startsWith(`${year}-`))
          .map((d) => ({
            date: d.date,
            count: d.contributionCount,
            weekday: d.weekday,
          })),
      ),
    }),
  };
}

export type ReposResult = {
  repos: Repo[];
  /** True when the page cap was hit while GitHub still had more repositories. */
  truncated: boolean;
};

/** Owned non-fork repos, oldest first, all pages (up to MAX_REPO_PAGES). */
export async function fetchRepos(
  token: string,
  login: string,
  signal?: AbortSignal,
): Promise<GraphqlResult<ReposResult>> {
  const repos: Repo[] = [];
  let truncated = false;
  let after: string | null = null;
  let rateLimit: RateLimitInfo | null = null;

  for (let page = 0; page < MAX_REPO_PAGES; page++) {
    const result: GraphqlResult<ReposData> = await githubGraphql<ReposData>(
      token,
      REPOS_QUERY,
      { login, after },
      signal,
    );
    if (!result.ok) return result;
    rateLimit = result.rateLimit;
    const connection:
      | NonNullable<ReposData["user"]>["repositories"]
      | undefined = result.data.user?.repositories;
    if (!connection) {
      return { ok: false, error: NOT_FOUND, rateLimit: result.rateLimit };
    }

    for (const node of connection.nodes) {
      if (!node) continue;
      repos.push({
        name: node.name,
        createdAt: node.createdAt,
        stars: node.stargazerCount,
        languages: (node.languages?.edges ?? []).map(
          (edge: { size: number; node: { name: string } }) => ({
            name: edge.node.name,
            size: edge.size,
          }),
        ),
      });
    }

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor)
      break;
    after = connection.pageInfo.endCursor;
    truncated = page === MAX_REPO_PAGES - 1;
  }
  return { ok: true, data: { repos, truncated }, rateLimit };
}
