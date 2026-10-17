import { describe, expect, it } from "vitest";
import { linePath, stepPath } from "./chart";
import { buildPlan } from "./plan";

const days = Array.from({ length: 28 }, (_, index) => ({
  date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10),
  commits: 1,
}));

describe("chart paths", () => {
  it("draws one solid path and no dashes without steps", () => {
    const plan = buildPlan(days);
    expect(linePath(plan).match(/M/g)).toHaveLength(1);
    expect(stepPath(plan)).toBe("");
  });

  it("breaks the solid line at a step and dashes the jump apart", () => {
    const plan = buildPlan(days, [{ year: 2024, dayIndex: 13, amount: 50 }]);
    expect(linePath(plan).match(/M/g)).toHaveLength(2);
    expect(stepPath(plan).match(/M/g)).toHaveLength(1);
    expect(plan.total).toBe(28 + 50);
    expect(plan.peak).toBe(78);
    // The jump is one vertical segment: same x before and after.
    const [from, to] = plan.linePoints.filter((point) => point.jump);
    expect(from?.progress).toBe(to?.progress);
    expect((to?.total ?? 0) - (from?.total ?? 0)).toBe(50);
  });

  it("accumulates steps that land on the same day instead of dropping one", () => {
    const plan = buildPlan(days, [
      { year: 2023, dayIndex: 13, amount: 50 },
      { year: 2024, dayIndex: 13, amount: 7 },
    ]);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.amount).toBe(57);
    expect(plan.total).toBe(28 + 57);
    expect(plan.cumulative.at(-1)).toBe(28 + 57);
  });
});
