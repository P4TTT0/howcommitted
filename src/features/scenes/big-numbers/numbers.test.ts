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
  COUNT_TICKS,
  countAt,
  countSounds,
  GRID_SECONDS,
  planBigNumbers,
  scopeNote,
  tickCount,
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
      "2023: 12 commits",
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

describe("tickCount", () => {
  it("follows the value for small numbers and caps big ones", () => {
    expect(tickCount(0)).toBe(0);
    expect(tickCount(1)).toBe(1);
    expect(tickCount(2)).toBe(2);
    expect(tickCount(COUNT_TICKS)).toBe(COUNT_TICKS);
    expect(tickCount(5_000_000)).toBe(COUNT_TICKS);
  });
});

describe("countSounds", () => {
  const span = { start: 1, land: 2 };

  it("makes exactly 2 ticks for a value of 2 and none for 0", () => {
    expect(countSounds({ ...span, total: 2 }, false)).toHaveLength(2);
    expect(countSounds({ ...span, total: 0 }, false)).toEqual([]);
  });

  it("rises with the value inside the count, never past 1", () => {
    const ticks = countSounds({ ...span, total: 1000 }, false);
    expect(ticks).toHaveLength(COUNT_TICKS);
    for (const [i, tick] of ticks.entries()) {
      expect(tick.time).toBeGreaterThanOrEqual(1);
      expect(tick.time).toBeLessThan(2);
      expect(tick.progress).toBeGreaterThan(0);
      expect(tick.progress).toBeLessThan(1);
      if (i > 0) {
        expect(tick.progress).toBeGreaterThan(ticks[i - 1]?.progress ?? 0);
        expect(tick.time).toBeGreaterThan(ticks[i - 1]?.time ?? 0);
      }
    }
  });

  it("ticks as the displayed count steps up, one per unit", () => {
    const full = { ...span, total: 5 };
    for (const [i, tick] of countSounds(full, false).entries()) {
      expect(countAt(full, tick.time + 1e-6, false)).toBe(i + 1);
    }
  });

  it("is silent when the number does not count", () => {
    expect(countSounds({ ...span, total: 50 }, true)).toEqual([]);
  });
});
