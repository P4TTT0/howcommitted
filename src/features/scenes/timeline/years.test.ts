import { describe, expect, it } from "vitest";
import { buildPlan } from "@/features/sequencer/model/plan";
import {
  planYearSlots,
  slotX,
  yearDetail,
  yearFill,
  yearReading,
} from "./years";

function daysOf(year: number, count: number, each: number) {
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(Date.UTC(year, 0, 1 + index)).toISOString().slice(0, 10),
    commits: each,
  }));
}

// 2023: 300 days of 1; 2024: 100 days of 4.
const plan = buildPlan([...daysOf(2023, 300, 1), ...daysOf(2024, 100, 4)]);

describe("planYearSlots", () => {
  const slots = planYearSlots(plan, 2024);

  it("makes one slot per year with totals that add up to the counter", () => {
    expect(slots.map((slot) => [slot.year, slot.contributions])).toEqual([
      [2023, 300],
      [2024, 400],
    ]);
    expect(slots.at(-1)?.endTotal).toBe(plan.total);
    expect(slots[1]?.startTotal).toBe(300);
  });

  it("scales blocks against the busiest year and rotates the palette", () => {
    expect(slots.map((slot) => slot.ratio)).toEqual([0.75, 1]);
    expect(slots.map((slot) => slot.colorIndex)).toEqual([0, 1]);
  });

  it("marks only the current year as in progress", () => {
    expect(slots.map((slot) => slot.inProgress)).toEqual([false, true]);
    expect(planYearSlots(plan, 2025).at(-1)?.inProgress).toBe(false);
  });

  it("includes an unattributed step in its year", () => {
    const stepped = buildPlan(daysOf(2023, 10, 1), [
      { year: 2023, dayIndex: 9, amount: 90 },
    ]);
    expect(planYearSlots(stepped, 2030)[0]?.contributions).toBe(100);
  });
});

describe("slotX", () => {
  const slots = planYearSlots(plan, 2024);

  it("gives every year an equal share of the width", () => {
    expect(slotX(slots, 0)).toBe(0);
    expect(slotX(slots, slots[0]?.endProgress ?? 0)).toBe(0.5);
    expect(slotX(slots, 1)).toBe(1);
  });

  it("moves linearly inside a year", () => {
    const half = (slots[0]?.endProgress ?? 0) / 2;
    expect(slotX(slots, half)).toBeCloseTo(0.25);
  });

  it("is 0 without slots", () => {
    expect(slotX([], 0.5)).toBe(0);
  });
});

describe("yearFill", () => {
  it("fills with the running total, clamped", () => {
    const [first] = planYearSlots(plan, 2024);
    if (!first) throw new Error("no slot");
    expect(yearFill(first, 0)).toBe(0);
    expect(yearFill(first, 150)).toBe(0.5);
    expect(yearFill(first, 9999)).toBe(1);
  });
});

describe("readings", () => {
  it("says contributions, never commits", () => {
    const slot = {
      year: 2024,
      inProgress: true,
      contributions: 1,
      endTotal: 5,
    };
    expect(yearReading(slot)).toBe(
      "2024 so far: 1 contribution this year, 5 in total",
    );
    expect(yearDetail({ contributions: 512, endTotal: 1575 })).toBe(
      "512 this year · 1,575 total",
    );
  });
});
