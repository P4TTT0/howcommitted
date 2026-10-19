import { describe, expect, it } from "vitest";
import type { RepoCommits } from "@/domain/types";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import {
  barReading,
  eraReading,
  MAX_ERAS,
  nameScale,
  planMainRepo,
  progressAt,
  shortName,
} from "./plan";

function historyWith(byYear: Record<number, RepoCommits[]>) {
  const years = Object.entries(byYear).map(([year, repoCommits]) => ({
    ...makeYear(Number(year), steadyDays(Number(year), 1, 30)),
    repoCommits,
  }));
  return makeHistory("ada", years);
}

describe("planMainRepo", () => {
  const history = historyWith({
    2022: [
      { repo: "ada/alpha", commits: 100, days: 40 },
      { repo: "ada/beta", commits: 30, days: 10 },
    ],
    2023: [
      { repo: "ada/alpha", commits: 200, days: 60 },
      { repo: "org/gamma", commits: 90, days: 20 },
    ],
  });

  it("is null without public repo commits", () => {
    expect(planMainRepo(historyWith({ 2023: [] }), 2023)).toBeNull();
  });

  it("names the main repo without its owner", () => {
    const plan = planMainRepo(history, 2022);
    expect(plan?.name).toBe("alpha");
    expect(plan?.repo).toMatchObject({ commits: 300, days: 100 });
    expect(plan?.span).toBe("2022 to 2023");
  });

  it("scales bars to the top repo and colors only the first", () => {
    const bars = planMainRepo(history, 2022)?.bars ?? [];
    expect(bars.map((bar) => bar.name)).toEqual(["alpha", "gamma", "beta"]);
    expect(bars[0]?.ratio).toBe(1);
    expect(bars[1]?.ratio).toBeCloseTo(0.3);
    expect(bars[0]?.background).not.toBe(bars[1]?.background);
    expect(bars[1]?.background).toBe(bars[2]?.background);
  });

  it("lists one era per year, oldest first, bars before eras in readings", () => {
    const plan = planMainRepo(history, 2022);
    expect(plan?.eras.map((era) => [era.year, era.name])).toEqual([
      [2022, "alpha"],
      [2023, "alpha"],
    ]);
    expect(plan?.readings).toHaveLength(
      (plan?.bars.length ?? 0) + (plan?.eras.length ?? 0),
    );
    expect(plan?.levels).toHaveLength(plan?.readings.length ?? -1);
    for (const level of plan?.levels ?? []) {
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  it("keeps only the last eight years", () => {
    const byYear: Record<number, RepoCommits[]> = {};
    for (let year = 2010; year <= 2022; year++) {
      byYear[year] = [{ repo: "ada/alpha", commits: 5, days: 2 }];
    }
    const plan = planMainRepo(historyWith(byYear), 2010);
    expect(plan?.eras).toHaveLength(MAX_ERAS);
    expect(plan?.eras[0]?.year).toBe(2015);
    expect(plan?.eras.at(-1)?.year).toBe(2022);
  });

  it("times everything on the clock, ending before the duration", () => {
    const plan = planMainRepo(history, 2022);
    const last = plan?.eras.at(-1)?.time ?? 0;
    expect(last).toBeGreaterThan(plan?.bars.at(-1)?.time ?? 0);
    expect(plan?.duration).toBeGreaterThan(last);
  });
});

describe("readings", () => {
  it("speaks counts to public repositories", () => {
    expect(barReading({ repo: "ada/alpha", commits: 1204, days: 1 })).toEqual({
      title: "alpha",
      detail:
        "ada/alpha · 1,204 commits to public repositories · 1 day with a commit",
    });
    expect(
      eraReading({ year: 2024, repo: "ada/alpha", commits: 1, language: "Go" }),
    ).toEqual({ title: "2024", detail: "ada/alpha · Go · 1 commit that year" });
  });
});

describe("helpers", () => {
  it("shortens names and shrinks long ones", () => {
    expect(shortName("ada/alpha")).toBe("alpha");
    expect(nameScale("short")).toBe(1);
    expect(nameScale("a-very-long-repository-name-indeed")).toBe(0.35);
  });

  it("eases from 0 to 1 and honors reduced motion", () => {
    expect(progressAt(1, 0.5, 0.5, false)).toBe(0);
    expect(progressAt(1, 0.5, 2, false)).toBe(1);
    expect(progressAt(1, 0.5, 1.1, true)).toBe(1);
    expect(progressAt(1, 0.5, 1.1, false)).toBeGreaterThan(0);
  });
});
