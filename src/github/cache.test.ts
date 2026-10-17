import { describe, expect, it } from "vitest";
import type { YearSummary } from "@/domain/types";
import {
  type CachedYear,
  createCache,
  isYearStale,
  TTL,
  ttlForYear,
} from "./cache";
import { createTestStore } from "./test-store";

const NOW = new Date("2026-10-16T12:00:00Z");
const DAY = 24 * 60 * 60;

const summary = (year: number): YearSummary => ({
  year,
  totals: {
    commits: 1,
    pullRequests: 0,
    reviews: 0,
    issues: 0,
    privateContributions: 0,
  },
  dailyCommits: [],
  reconciliation: { summed: 0, official: 1, difference: 1, matches: false },
  calendar: [],
});

describe("ttlForYear", () => {
  it("keeps past years for 30 days and the current year for its stale window", () => {
    expect(ttlForYear(2025, NOW)).toBe(30 * DAY);
    expect(ttlForYear(2026, NOW)).toBe(TTL.yearCurrentRetained);
  });
});

describe("isYearStale", () => {
  const entry = (year: number, fetchedAt: string): CachedYear => ({
    summary: summary(year),
    fetchedAt,
  });

  it("only the current year goes stale, after 6 hours", () => {
    expect(isYearStale(entry(2026, "2026-10-16T06:01:00Z"), NOW)).toBe(false);
    expect(isYearStale(entry(2026, "2026-10-16T05:59:00Z"), NOW)).toBe(true);
    expect(isYearStale(entry(2025, "2026-03-01T00:00:00Z"), NOW)).toBe(false);
  });

  it("goes stale across the year boundary when fetched before the year ended", () => {
    const fetchedInDecember = entry(2026, "2026-12-31T23:00:00Z");
    expect(
      isYearStale(fetchedInDecember, new Date("2026-12-31T23:30:00Z")),
    ).toBe(false);
    expect(
      isYearStale(fetchedInDecember, new Date("2027-01-01T00:30:00Z")),
    ).toBe(true);
    // A year fetched after it ended is final, and so are older years fetched later.
    expect(
      isYearStale(
        entry(2026, "2027-01-02T00:00:00Z"),
        new Date("2027-06-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("createCache", () => {
  it("uses the documented key format, lowercased, with an optional prefix", async () => {
    const { store, values, ttls } = createTestStore();
    const cache = createCache(store, "preview:");

    await cache.setUser({
      login: "Torvalds",
      name: null,
      avatarUrl: "a",
      createdAt: "2011-01-01T00:00:00Z",
      contributionYears: [2026],
    });
    await cache.setYear("Torvalds", summary(2024), NOW);
    await cache.setYear("Torvalds", summary(2026), NOW);
    await cache.setRepos("Torvalds", [], false);
    await cache.markMissing("ghost");
    await cache.setFailure("Ghost", { status: "timeout" });

    expect([...values.keys()].sort()).toEqual([
      "preview:v2:failed:ghost",
      "preview:v2:missing:ghost",
      "preview:v2:repos:torvalds",
      "preview:v2:user:torvalds",
      "preview:v2:year:torvalds:2024",
      "preview:v2:year:torvalds:2026",
    ]);
    expect(ttls.get("preview:v2:user:torvalds")).toBe(TTL.user);
    expect(ttls.get("preview:v2:year:torvalds:2024")).toBe(TTL.yearPast);
    expect(ttls.get("preview:v2:year:torvalds:2026")).toBe(
      TTL.yearCurrentRetained,
    );
    expect(ttls.get("preview:v2:repos:torvalds")).toBe(TTL.repos);
    expect(ttls.get("preview:v2:missing:ghost")).toBe(TTL.missing);
    expect(ttls.get("preview:v2:failed:ghost")).toBe(TTL.failure);
  });

  it("reads back what it stored and reports negative cache", async () => {
    const { store } = createTestStore();
    const cache = createCache(store, "");
    expect(await cache.getYear("a", 2024)).toBeNull();
    await cache.setYear("a", summary(2024), NOW);
    expect(await cache.getYear("A", 2024)).toEqual({
      summary: summary(2024),
      fetchedAt: NOW.toISOString(),
    });
    expect(await cache.getRepos("a")).toBeNull();
    expect(await cache.getFailure("a")).toBeNull();
    expect(await cache.isMissing("a")).toBe(false);
    await cache.markMissing("a");
    expect(await cache.isMissing("A")).toBe(true);
  });
});
