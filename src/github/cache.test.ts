import { describe, expect, it } from "vitest";
import type { YearSummary } from "@/domain/types";
import { createCache, TTL, ttlForYear } from "./cache";
import { createMemoryStore } from "./memory-store";

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
  it("caches past years for 30 days and the current year for 6 hours", () => {
    expect(ttlForYear(2025, NOW)).toBe(30 * DAY);
    expect(ttlForYear(2026, NOW)).toBe(6 * 60 * 60);
  });
});

describe("createCache", () => {
  it("uses the documented key format, lowercased, with an optional prefix", async () => {
    const { store, values, ttls } = createMemoryStore();
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
    await cache.setRepos("Torvalds", []);
    await cache.markMissing("ghost");

    expect([...values.keys()].sort()).toEqual([
      "preview:v1:missing:ghost",
      "preview:v1:repos:torvalds",
      "preview:v1:user:torvalds",
      "preview:v1:year:torvalds:2024",
      "preview:v1:year:torvalds:2026",
    ]);
    expect(ttls.get("preview:v1:user:torvalds")).toBe(TTL.user);
    expect(ttls.get("preview:v1:year:torvalds:2024")).toBe(TTL.yearPast);
    expect(ttls.get("preview:v1:year:torvalds:2026")).toBe(TTL.yearCurrent);
    expect(ttls.get("preview:v1:repos:torvalds")).toBe(TTL.repos);
    expect(ttls.get("preview:v1:missing:ghost")).toBe(TTL.missing);
  });

  it("reads back what it stored and reports negative cache", async () => {
    const { store } = createMemoryStore();
    const cache = createCache(store, "");
    expect(await cache.getYear("a", 2024)).toBeNull();
    await cache.setYear("a", summary(2024), NOW);
    expect(await cache.getYear("A", 2024)).toEqual(summary(2024));
    expect(await cache.isMissing("a")).toBe(false);
    await cache.markMissing("a");
    expect(await cache.isMissing("A")).toBe(true);
  });
});
