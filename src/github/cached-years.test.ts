import { describe, expect, it, vi } from "vitest";
import type { UserProfile, YearSummary } from "@/domain/types";
import { createCache } from "./cache";
import { readCachedYears } from "./cached-years";
import { createTestStore } from "./test-store";

const NOW = new Date("2026-10-16T12:00:00Z");

const user: UserProfile = {
  login: "Octo",
  name: null,
  avatarUrl: "",
  createdAt: "2024-01-01T00:00:00Z",
  contributionYears: [2025, 2024],
};

const summary = (year: number): YearSummary => ({
  year,
  totals: {
    commits: 0,
    pullRequests: 0,
    reviews: 0,
    issues: 0,
    privateContributions: 0,
  },
  dailyCommits: [],
  reconciliation: { summed: 0, official: 0, difference: 0, matches: true },
  calendar: [],
  totalContributions: year,
});

function setup() {
  const { store, values } = createTestStore();
  const cache = createCache(store, "");
  return { store, values, cache };
}

async function seed(cache: ReturnType<typeof setup>["cache"], years: number[]) {
  await cache.setUser(user);
  for (const year of years) await cache.setYear("octo", summary(year), NOW);
}

describe("readCachedYears", () => {
  it("returns the user and all years, oldest first, for a complete cache", async () => {
    const { cache } = setup();
    await seed(cache, [2024, 2025, 2026]);
    const result = await readCachedYears("octo", cache, NOW);
    expect(result?.years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
    expect(result?.user.login).toBe("Octo");
  });

  it("is null when the user is not cached", async () => {
    const { cache } = setup();
    expect(await readCachedYears("octo", cache, NOW)).toBeNull();
  });

  it("is null when a needed year is missing, so totals are never partial", async () => {
    const { cache } = setup();
    await seed(cache, [2025, 2026]);
    expect(await readCachedYears("octo", cache, NOW)).toBeNull();
  });

  it("only reads: it writes nothing and takes no lock", async () => {
    const { store, cache } = setup();
    await seed(cache, [2024, 2025, 2026]);
    const set = vi.spyOn(store, "set");
    const evalSpy = vi.spyOn(store, "eval");
    await readCachedYears("octo", cache, NOW);
    await readCachedYears("missing", cache, NOW);
    expect(set).not.toHaveBeenCalled();
    expect(evalSpy).not.toHaveBeenCalled();
  });

  it("is null instead of throwing when Redis fails", async () => {
    const { store, cache } = setup();
    vi.spyOn(store, "get").mockRejectedValue(new Error("down"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await readCachedYears("octo", cache, NOW)).toBeNull();
  });
});
