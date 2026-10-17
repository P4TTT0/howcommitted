import { describe, expect, it } from "vitest";
import { generateFakeProfile } from "./fakeProfile";
import {
  blockForYearIndex,
  buildPlan,
  DRAW_SECONDS,
  displayedYearIndex,
  floodSpan,
  GRID_SECONDS,
  yearReveals,
} from "./plan";

describe("generateFakeProfile", () => {
  it("is deterministic for a seed", () => {
    expect(generateFakeProfile(7)).toEqual(generateFakeProfile(7));
    expect(generateFakeProfile(7)).not.toEqual(generateFakeProfile(8));
  });

  it("spans eight calendar years with a plausible total", () => {
    const days = generateFakeProfile();
    expect(new Set(days.map((day) => day.date.slice(0, 4))).size).toBe(8);
    const total = days.reduce((sum, day) => sum + day.commits, 0);
    expect(total).toBeGreaterThan(3000);
    expect(total).toBeLessThan(20000);
  });
});

describe("buildPlan", () => {
  const plan = buildPlan(generateFakeProfile());

  it("never schedules more than one hit per grid cell", () => {
    const cells = plan.slots.map((slot) =>
      Math.round(slot.time / GRID_SECONDS),
    );
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("keeps all hits inside the drawing window", () => {
    for (const slot of plan.slots) {
      expect(slot.time).toBeLessThanOrEqual(DRAW_SECONDS + GRID_SECONDS);
    }
    for (const milestone of plan.milestones) {
      expect(milestone.time).toBeLessThanOrEqual(DRAW_SECONDS + GRID_SECONDS);
    }
  });

  it("aggregates: far fewer hits than commits", () => {
    expect(plan.slots.length).toBeLessThan(plan.total / 5);
  });

  it("ends on exactly one final milestone with the full total", () => {
    const finals = plan.milestones.filter((m) => m.kind === "final");
    expect(finals).toHaveLength(1);
    expect(finals[0]?.value).toBe(plan.total);
    expect(plan.slots.at(-1)?.total).toBe(plan.total);
  });
});

describe("blockForYearIndex", () => {
  it("rotates through the six blocks", () => {
    expect(blockForYearIndex(0)).toBe(blockForYearIndex(6));
    expect(blockForYearIndex(0)).not.toBe(blockForYearIndex(1));
  });
});

describe("yearReveals", () => {
  const plan = buildPlan(generateFakeProfile());
  const reveals = yearReveals(plan);

  it("reveals every year in order, the first at time zero", () => {
    expect(reveals).toHaveLength(plan.years.length);
    expect(reveals[0]?.time).toBe(0);
    for (let i = 1; i < reveals.length; i += 1) {
      expect(reveals[i]?.time).toBeGreaterThan(reveals[i - 1]?.time ?? 0);
    }
  });

  it("never lands inside a flood", () => {
    for (const reveal of reveals.slice(1)) {
      for (const milestone of plan.milestones) {
        const end = milestone.time + floodSpan(milestone.kind);
        const inside = reveal.time > milestone.time && reveal.time < end;
        expect(inside).toBe(false);
      }
    }
  });

  it("resolves the year block on screen at a time", () => {
    expect(displayedYearIndex(reveals, 0)).toBe(0);
    const last = reveals.at(-1);
    expect(displayedYearIndex(reveals, last?.time ?? 0)).toBe(last?.index);
  });
});
