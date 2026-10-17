import { describe, expect, it } from "vitest";
import type { DailyCommits } from "./aggregate";
import { aggregateWeekly, weekSpan } from "./aggregate";
import { buildTickSlots, findMilestones, quantizeUp } from "./schedule";

function days(counts: number[]): DailyCommits[] {
  const origin = Date.parse("2024-01-01T00:00:00Z");
  return counts.map((count, index) => ({
    date: new Date(origin + index * 86_400_000).toISOString().slice(0, 10),
    count,
  }));
}

describe("quantizeUp", () => {
  it("rounds up to the grid and keeps exact grid times", () => {
    expect(quantizeUp(0.31, 0.25)).toBe(0.5);
    expect(quantizeUp(0.5, 0.25)).toBe(0.5);
    expect(quantizeUp(0, 0.25)).toBe(0);
  });
});

describe("buildTickSlots", () => {
  const options = { duration: 10, grid: 0.5, runGapWeeks: 2 };

  function slotsFor(counts: number[], extra = {}) {
    const data = days(counts);
    return buildTickSlots(aggregateWeekly(data), weekSpan(data), {
      ...options,
      ...extra,
    });
  }

  it("puts every slot on the grid", () => {
    const weeklyOnes = Array.from({ length: 70 }, (_, i) =>
      i % 7 === 0 ? 3 : 0,
    );
    for (const slot of slotsFor(weeklyOnes)) {
      expect(slot.time / options.grid).toBeCloseTo(
        Math.round(slot.time / options.grid),
      );
    }
  });

  it("merges weeks that share a grid cell into one slot", () => {
    // 10 weeks over 10 s is 1 s per week; a 2 s grid forces pairs.
    const counts = Array.from({ length: 70 }, (_, i) => (i % 7 === 0 ? 1 : 0));
    const slots = slotsFor(counts, { grid: 2 });
    expect(slots).toHaveLength(5);
    expect(slots.every((slot) => slot.count === 2)).toBe(true);
  });

  it("never sounds more than once per grid cell", () => {
    const counts = Array.from({ length: 700 }, () => 1);
    const slots = slotsFor(counts);
    const times = slots.map((slot) => slot.time);
    expect(new Set(times).size).toBe(times.length);
    expect(slots.length).toBeLessThanOrEqual(10 / options.grid);
  });

  it("tracks the running total and ends at the sum", () => {
    const counts = [5, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 1];
    const slots = slotsFor(counts);
    expect(slots.map((slot) => slot.total)).toEqual([5, 9, 10]);
  });

  it("starts a new run after a quiet gap", () => {
    // Weeks 0, 1, then silence for 3 weeks, then week 5.
    const counts = Array.from({ length: 42 }, () => 0);
    counts[0] = 2;
    counts[7] = 3;
    counts[35] = 4;
    const slots = slotsFor(counts);
    expect(slots.map((slot) => slot.run)).toEqual([0, 0, 1]);
    expect(slots.map((slot) => slot.runAccumulated)).toEqual([2, 5, 4]);
  });

  it("starts a new run after a payoff time", () => {
    const counts = Array.from({ length: 42 }, (_, i) => (i % 7 === 0 ? 1 : 0));
    const slots = slotsFor(counts, { resetTimes: [4] });
    const before = slots.filter((slot) => slot.time <= 4);
    const after = slots.filter((slot) => slot.time > 4);
    expect(new Set(before.map((slot) => slot.run))).toEqual(new Set([0]));
    expect(new Set(after.map((slot) => slot.run))).toEqual(new Set([1]));
    expect(after[0]?.runAccumulated).toBe(1);
  });

  it("returns nothing for empty input", () => {
    expect(slotsFor([])).toEqual([]);
  });
});

describe("findMilestones", () => {
  const options = { duration: 10, grid: 0.5, step: 1000, minGapToFinal: 1 };

  it("marks each multiple of the step and the final total", () => {
    const data = days(Array.from({ length: 100 }, () => 35)); // 3,500 total
    const milestones = findMilestones(data, options);
    expect(milestones.map((m) => [m.kind, m.value])).toEqual([
      ["step", 1000],
      ["step", 2000],
      ["step", 3000],
      ["final", 3500],
    ]);
  });

  it("can start with an earlier first milestone", () => {
    const data = days(Array.from({ length: 100 }, () => 35)); // 3,500 total
    const values = findMilestones(data, { ...options, first: 500 }).map(
      (m) => m.value,
    );
    expect(values).toEqual([500, 1000, 2000, 3000, 3500]);
  });

  it("orders milestones in time and keeps them on the grid", () => {
    const data = days(Array.from({ length: 100 }, () => 35));
    const times = findMilestones(data, options).map((m) => m.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    for (const time of times) {
      expect(time / options.grid).toBeCloseTo(Math.round(time / options.grid));
    }
  });

  it("drops a step milestone too close to the final one", () => {
    const data = days(Array.from({ length: 100 }, () => 10.1)); // 1,010 total
    const milestones = findMilestones(data, options);
    expect(milestones.map((m) => m.kind)).toEqual(["final"]);
  });

  it("does not repeat a threshold crossed by one big day", () => {
    const data = days([5000, ...Array.from({ length: 99 }, () => 10)]);
    const steps = findMilestones(data, options).filter(
      (m) => m.kind === "step",
    );
    expect(steps).toHaveLength(1);
    expect(steps[0]?.value).toBe(1000);
  });

  it("returns nothing without commits", () => {
    expect(findMilestones(days([0, 0]), options)).toEqual([]);
    expect(findMilestones([], options)).toEqual([]);
  });
});
