import { describe, expect, it } from "vitest";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { recordsScene } from "./index";
import {
  formatMonthDay,
  formatRange,
  formatWeek,
  GRID_SECONDS,
  planRecords,
  popAt,
  STRIP_SECONDS,
  streakTicks,
  stripFillAt,
  stripPopTimes,
} from "./plan";

const history = makeHistory("ada", [
  makeYear(2023, steadyDays(2023, 2, 1)),
  makeYear(2024, steadyDays(2024, 3, 2)),
]);

describe("planRecords", () => {
  it("returns null without activity", () => {
    expect(planRecords(makeHistory("ada", [makeYear(2024, [])]))).toBeNull();
  });

  it("builds the eight tiles in the artboard order", () => {
    const plan = planRecords(history);
    expect(plan?.tiles.map((tile) => tile.label)).toEqual([
      "Busiest day",
      "Average per active day",
      "Days with a contribution",
      "Longest quiet stretch",
      "Busiest week",
      "Busiest month",
      "Your date",
      "Busiest year",
    ]);
  });

  it("reports the streak and one tick per day when it is short", () => {
    const plan = planRecords(history);
    // 2023 is daily: the whole year (and Jan 1 2024) forms the streak.
    expect(plan?.streakDays).toBeGreaterThan(300);
    expect(plan?.ticks.length).toBeLessThanOrEqual(120);
    expect(plan?.streakRange).toMatch(/^Jan 1, 2023 — /);
    expect(plan?.yearsNote).toBe("2023 — 2024");
  });

  it("puts tile starts on the grid, in order", () => {
    const starts = planRecords(history)?.tiles.map((tile) => tile.start) ?? [];
    for (const start of starts) {
      expect(start / GRID_SECONDS).toBeCloseTo(
        Math.round(start / GRID_SECONDS),
      );
    }
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("words the your-date tile with the years it was active", () => {
    const tile = planRecords(history)?.tiles.find((t) => t.key === "your-date");
    expect(tile?.note).toMatch(/^A contribution on it in \d+ of 2 years$/);
  });
});

describe("formatting", () => {
  it("formats ranges, weeks and dates in UTC", () => {
    expect(formatRange("2024-03-03", "2024-06-22")).toBe(
      "Mar 3 — Jun 22, 2024",
    );
    expect(formatRange("2023-12-30", "2024-01-05")).toBe(
      "Dec 30, 2023 — Jan 5, 2024",
    );
    expect(formatWeek("2024-03-11", "2024-03-17")).toBe("Mar 11 — 17, 2024");
    expect(formatWeek("2024-03-28", "2024-04-03")).toBe("Mar 28 — Apr 3, 2024");
    expect(formatMonthDay("03-14")).toBe("Mar 14");
    expect(formatMonthDay("02-29")).toBe("Feb 29");
  });
});

describe("streakTicks", () => {
  it("keeps one tick per day up to the cap, then buckets", () => {
    expect(streakTicks([1, 2, 4])).toHaveLength(3);
    expect(streakTicks(Array.from({ length: 500 }, () => 1))).toHaveLength(100);
  });

  it("keeps opacities between 0.45 and 1", () => {
    const ticks = streakTicks([1, 5, 10]);
    expect(Math.max(...ticks)).toBe(1);
    expect(Math.min(...ticks)).toBeGreaterThanOrEqual(0.45);
  });
});

describe("animation", () => {
  it("fills the strip and pops tiles without overshoot", () => {
    const plan = { stripStart: 1 };
    expect(stripFillAt(plan, 0, false)).toBe(0);
    expect(stripFillAt(plan, 100, false)).toBe(1);
    expect(stripFillAt(plan, 0, true)).toBe(1);
    expect(popAt({ start: 1 }, 0, false)).toBe(0);
    expect(popAt({ start: 1 }, 5, false)).toBe(1);
    expect(popAt({ start: 1 }, 0, true)).toBe(1);
  });
});

describe("recordsScene", () => {
  it("is skipped without a history", () => {
    const instance = recordsScene.create({
      login: "ada",
      model: {} as never,
      history: null,
    });
    expect(instance).toBeNull();
  });
});

describe("stripPopTimes", () => {
  const plan = { stripStart: 1, ticks: new Array<number>(120).fill(1) };

  it("pops on the grid, inside the strip draw, without repeats", () => {
    const times = stripPopTimes(plan);
    expect(times.length).toBeGreaterThan(0);
    expect(times.length).toBeLessThanOrEqual(plan.ticks.length);
    expect(new Set(times).size).toBe(times.length);
    for (const time of times) {
      expect(time).toBeGreaterThan(plan.stripStart);
      expect(time).toBeLessThanOrEqual(
        plan.stripStart + STRIP_SECONDS + GRID_SECONDS,
      );
      expect(
        Math.abs(time / GRID_SECONDS - Math.round(time / GRID_SECONDS)),
      ).toBeLessThan(1e-6);
    }
  });

  it("is silent without ticks", () => {
    expect(stripPopTimes({ stripStart: 1, ticks: [] })).toEqual([]);
  });
});
