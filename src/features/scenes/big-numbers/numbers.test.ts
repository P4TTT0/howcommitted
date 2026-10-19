import { describe, expect, it } from "vitest";
import type { History } from "@/domain/history";
import { labSceneData } from "@/features/experience/labData";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { bigNumbersScene } from "./index";
import {
  countAt,
  countSounds,
  GRID_SECONDS,
  planBigNumbers,
  scopeNote,
  totalReading,
  yearReading,
} from "./numbers";

function history(totals: Partial<History["totals"]> = {}): History {
  const withTotals = (
    year: number,
    every: number,
    yearTotals: History["totals"],
  ) => ({
    ...makeYear(year, steadyDays(year, every)),
    totals: yearTotals,
  });
  const base = makeHistory("ada", [
    withTotals(2022, 2, {
      commits: 400,
      pullRequests: 10,
      reviews: 5,
      issues: 1,
      privateContributions: 0,
    }),
    withTotals(2023, 3, {
      commits: 1200,
      pullRequests: 30,
      reviews: 20,
      issues: 4,
      privateContributions: 0,
    }),
  ]);
  return {
    ...base,
    totals: {
      commits: 1600,
      pullRequests: 40,
      reviews: 25,
      issues: 5,
      privateContributions: 0,
      ...totals,
    },
  };
}

describe("planBigNumbers", () => {
  it("lists commits, PRs, reviews and issues with exact totals", () => {
    const plan = planBigNumbers(history());
    expect(plan?.numbers.map((n) => [n.label, n.total])).toEqual([
      ["Commits", 1600],
      ["Pull requests", 40],
      ["Reviews", 25],
      ["Issues", 5],
    ]);
    expect(plan?.numbers[0]?.perYear).toEqual([
      { year: 2022, value: 400 },
      { year: 2023, value: 1200 },
    ]);
  });

  it("puts every start and landing on the grid, in order", () => {
    const plan = planBigNumbers(history());
    const times = plan?.numbers.flatMap((n) => [n.start, n.land]) ?? [];
    for (const time of times) {
      expect(time / GRID_SECONDS).toBeCloseTo(Math.round(time / GRID_SECONDS));
    }
    const lands = plan?.numbers.map((n) => n.land) ?? [];
    expect([...lands].sort((a, b) => a - b)).toEqual(lands);
    expect(plan?.duration).toBeGreaterThan(lands.at(-1) ?? 0);
  });

  it("returns null when every total is zero", () => {
    const zero = {
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
      privateContributions: 0,
    };
    expect(planBigNumbers(history(zero))).toBeNull();
  });
});

describe("countAt", () => {
  const number = { total: 1000, start: 1, land: 2 };

  it("counts up and lands exactly on the total", () => {
    expect(countAt(number, 0.5, false)).toBe(0);
    const mid = countAt(number, 1.5, false);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1000);
    expect(countAt(number, 2, false)).toBe(1000);
    expect(countAt(number, 9, false)).toBe(1000);
  });

  it("shows the total from the start under reduced motion", () => {
    expect(countAt(number, 1.2, true)).toBe(1000);
    expect(countAt(number, 0.5, true)).toBe(0);
  });
});

describe("readings", () => {
  it("states exact values", () => {
    const number = { label: "Commits", total: 4458 };
    expect(totalReading(number)).toBe("Commits: 4,458 in total");
    expect(yearReading(number, { year: 2023, value: 12 })).toBe(
      "Commits in 2023: 12",
    );
  });

  it("says the numbers are public and mentions shared private activity", () => {
    expect(scopeNote(0)).toMatch(/public/i);
    expect(scopeNote(0)).not.toMatch(/private/i);
    expect(scopeNote(1200)).toContain("1,200 private contributions");
  });
});

describe("bigNumbersScene.create", () => {
  it("is skipped without a full history (the lab)", () => {
    expect(bigNumbersScene.create(labSceneData())).toBeNull();
  });

  it("is skipped when every total is zero", () => {
    const data = history({
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      issues: 0,
    });
    const scene = bigNumbersScene.create({
      login: "ada",
      model: planFromHistory(data),
      history: data,
    });
    expect(scene).toBeNull();
  });

  it("builds a scene with a duration and explore", () => {
    const data = history();
    const scene = bigNumbersScene.create({
      login: "ada",
      model: planFromHistory(data),
      history: data,
    });
    expect(scene?.duration).toBeGreaterThanOrEqual(4);
    expect(scene?.explore).toBeTypeOf("function");
  });
});

describe("countSounds", () => {
  const number = { start: 1, land: 2 };

  it("rises with the displayed value, from 0 and never past 1", () => {
    const ticks = countSounds(number, false, 5);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toEqual({ time: 1, progress: 0 });
    for (const [i, tick] of ticks.entries()) {
      expect(tick.time).toBeGreaterThanOrEqual(1);
      expect(tick.time).toBeLessThan(2);
      expect(tick.progress).toBeLessThan(1);
      if (i > 0)
        expect(tick.progress).toBeGreaterThan(ticks[i - 1]?.progress ?? 0);
    }
  });

  it("matches countAt at each tick", () => {
    const full = { ...number, total: 1000 };
    for (const tick of countSounds(number, false)) {
      expect(Math.round(tick.progress * 1000)).toBe(
        countAt(full, tick.time, false),
      );
    }
  });

  it("is silent when the number does not count", () => {
    expect(countSounds(number, true)).toEqual([]);
  });
});
