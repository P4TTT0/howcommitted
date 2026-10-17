import { afterEach, describe, expect, it, vi } from "vitest";
import { buildYearSummary } from "@/domain/year-summary";
import { ConfigError } from "./config";
import type { ProfileResult } from "./profile";
import {
  historyResponse,
  invalidLogin,
  previewRateLimited,
  previewResponse,
  serverError,
} from "./responses";

afterEach(() => vi.restoreAllMocks());

const codeOf = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

describe("historyResponse status mapping", () => {
  it.each<[ProfileResult, number, string]>([
    [{ status: "not_found" }, 404, "not_found"],
    [
      { status: "login_required", reason: "quota_exhausted" },
      401,
      "login_required",
    ],
    [{ status: "degraded", reason: "circuit_open" }, 503, "degraded"],
    [{ status: "degraded", reason: "store_down" }, 503, "degraded"],
    [{ status: "degraded", reason: "busy" }, 503, "degraded"],
    [{ status: "rate_limited", resetAt: null }, 429, "rate_limited"],
    [{ status: "timeout" }, 504, "timeout"],
    [{ status: "upstream_error", message: "boom" }, 502, "upstream_error"],
  ])("maps %j to %i", async (result, status, code) => {
    const response = historyResponse(result, null);
    expect(response.status).toBe(status);
    expect(await codeOf(response)).toBe(code);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("names the degraded reason and the preview limit in the body", async () => {
    const degraded = historyResponse(
      { status: "degraded", reason: "circuit_open" },
      null,
    );
    expect(
      ((await degraded.json()) as { error: { reason: string } }).error.reason,
    ).toBe("circuit_open");
    const limited = previewRateLimited();
    expect(
      ((await limited.json()) as { error: { reason: string } }).error.reason,
    ).toBe("ip_limit");
  });

  it("tells clients when to retry while degraded", () => {
    const response = historyResponse(
      { status: "degraded", reason: "circuit_open" },
      null,
    );
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("keeps the visitor cookie on error responses", () => {
    const response = historyResponse({ status: "not_found" }, "hc_visitor=x");
    expect(response.headers.get("set-cookie")).toBe("hc_visitor=x");
  });

  it("returns the history with its source on success", async () => {
    const response = historyResponse(
      {
        status: "ok",
        source: "cache",
        reposTruncated: true,
        profile: {
          user: {
            login: "ada",
            name: null,
            avatarUrl: "a",
            createdAt: "2019-01-01T00:00:00Z",
            contributionYears: [],
          },
          years: [],
          repos: [],
        },
      },
      "hc_visitor=y",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBe("hc_visitor=y");
    const body = (await response.json()) as {
      source: string;
      reposTruncated: boolean;
      history: { user: { login: string }; years: unknown[] };
    };
    expect(body.source).toBe("cache");
    expect(body.reposTruncated).toBe(true);
    expect(body.history.user.login).toBe("ada");
    expect(body.history.years).toEqual([]);
  });
});

describe("history response contract", () => {
  it("exposes exactly the documented keys, including the private count", async () => {
    const response = historyResponse(
      {
        status: "ok",
        source: "fresh",
        reposTruncated: false,
        profile: {
          user: {
            login: "ada",
            name: "Ada",
            avatarUrl: "https://avatars.example/ada",
            createdAt: "2019-01-01T00:00:00Z",
            contributionYears: [2024],
          },
          years: [
            buildYearSummary({
              year: 2024,
              totals: {
                commits: 3,
                pullRequests: 1,
                reviews: 2,
                issues: 4,
                privateContributions: 7,
              },
              commitContributionsByRepo: [
                [{ occurredAt: "2024-02-29T10:00:00Z", commitCount: 3 }],
              ],
              calendar: [{ date: "2024-02-29", count: 5, weekday: 4 }],
              totalContributions: 5,
            }),
          ],
          repos: [
            {
              name: "engine",
              createdAt: "2020-01-01T00:00:00Z",
              stars: 12,
              languages: [{ name: "Rust", size: 10 }],
            },
          ],
        },
      },
      null,
    );
    // biome-ignore lint/suspicious/noExplicitAny: ad-hoc JSON walking in a contract test
    const body = (await response.json()) as Record<string, any>;
    const keys = (value: object) => Object.keys(value).sort();

    expect(keys(body)).toEqual(["history", "reposTruncated", "source"]);
    expect(keys(body.history)).toEqual([
      "languages",
      "longestStreak",
      "repoFlags",
      "totalContributions",
      "totals",
      "user",
      "yearBlocks",
      "years",
    ]);
    expect(keys(body.history.user)).toEqual([
      "avatarUrl",
      "createdAt",
      "login",
      "name",
    ]);
    expect(keys(body.history.years[0])).toEqual([
      "dailyCommits",
      "dailyContributions",
      "heatmap",
      "reconciliation",
      "totalContributions",
      "totals",
      "year",
    ]);
    expect(keys(body.history.years[0].totals)).toEqual([
      "commits",
      "issues",
      "privateContributions",
      "pullRequests",
      "reviews",
    ]);
    expect(keys(body.history.years[0].reconciliation)).toEqual([
      "difference",
      "matches",
      "official",
      "summed",
    ]);
    expect(keys(body.history.years[0].heatmap[0])).toEqual([
      "contributions",
      "date",
      "level",
      "week",
      "weekday",
    ]);
    expect(keys(body.history.longestStreak)).toEqual([
      "end",
      "length",
      "start",
    ]);
    expect(keys(body.history.yearBlocks[0])).toEqual(["contributions", "year"]);
    expect(keys(body.history.languages[0])).toEqual([
      "isOther",
      "name",
      "share",
      "size",
    ]);
    expect(keys(body.history.repoFlags[0])).toEqual([
      "createdAt",
      "name",
      "reason",
      "stars",
    ]);
    expect(body.history.years[0].totals.privateContributions).toBe(7);
    expect(body.history.totals.privateContributions).toBe(7);
  });
});

describe("other responses", () => {
  it("returns 400 for invalid logins", async () => {
    const response = invalidLogin();
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe("invalid_login");
  });

  it("returns the preview user on success", async () => {
    const response = previewResponse({
      status: "ok",
      user: {
        login: "ada",
        name: "Ada",
        avatarUrl: "a",
        createdAt: "2019-01-01T00:00:00Z",
        contributionYears: [2024],
      },
    });
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { user: { login: string } }).user.login,
    ).toBe("ada");
  });

  it("hides internals on server errors and names missing config", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const config = serverError(new ConfigError("GITHUB_TOKEN"));
    expect(config.status).toBe(500);
    expect(await codeOf(config)).toBe("server_misconfigured");

    const other = serverError(new Error("secret detail"));
    expect(JSON.stringify(await other.json())).not.toContain("secret detail");
  });
});
