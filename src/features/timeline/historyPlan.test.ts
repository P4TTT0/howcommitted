import { describe, expect, it } from "vitest";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import {
  distribute,
  incompleteDetailNote,
  planFromHistory,
} from "./historyPlan";
import {
  DRAW_SECONDS,
  GRID_SECONDS,
  MAX_STEP_MILESTONES,
  milestoneSchedule,
} from "./plan";

const TODAY = new Date("2026-10-17T12:00:00Z");

describe("distribute", () => {
  it("adds up exactly and follows the weights", () => {
    const parts = distribute([1, 2, 0, 1], 10);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(parts[2]).toBe(0);
    expect(parts[1]).toBeGreaterThan(parts[0] ?? 0);
  });

  it("spreads evenly when there are no weights", () => {
    expect(distribute([0, 0, 0], 7)).toEqual([3, 2, 2]);
  });

  it("returns zeros for a zero target", () => {
    expect(distribute([1, 1], 0)).toEqual([0, 0]);
  });
});

describe("milestoneSchedule", () => {
  it("keeps 1,000 steps with an early first payoff for normal profiles", () => {
    expect(milestoneSchedule(8_000)).toEqual({ step: 1000, first: 500 });
  });

  it("handles an empty history", () => {
    expect(milestoneSchedule(0)).toEqual({ step: 1000, first: 500 });
  });

  it("switches exactly above 12 step milestones", () => {
    expect(milestoneSchedule(12_000)).toEqual({ step: 1000, first: 500 });
    expect(milestoneSchedule(12_001)).toEqual({ step: 2000, first: 1000 });
  });

  it("widens the step so large profiles stay bounded", () => {
    expect(milestoneSchedule(30_000)).toEqual({ step: 5000, first: 2500 });
    const { step } = milestoneSchedule(250_000);
    expect(250_000 / step).toBeLessThanOrEqual(MAX_STEP_MILESTONES);
  });
});

describe("incompleteDetailNote", () => {
  it("is silent when every year reconciles", () => {
    expect(incompleteDetailNote([])).toBeNull();
  });

  it("names the years, then counts them", () => {
    expect(incompleteDetailNote([2019])).toBe(
      "Daily detail incomplete for 2019; totals are exact.",
    );
    expect(incompleteDetailNote([2015, 2016, 2017, 2018])).toBe(
      "Daily detail incomplete for 4 years; totals are exact.",
    );
  });
});

describe("planFromHistory", () => {
  it("ends on the official total across several years", () => {
    const history = makeHistory("ada", [
      makeYear(2022, steadyDays(2022, 2)),
      makeYear(2023, steadyDays(2023, 3)),
      makeYear(2024, steadyDays(2024, 1)),
    ]);
    const result = planFromHistory(history, TODAY);
    expect(result.plan.total).toBe(history.totals.commits);
    expect(result.plan.years.map((span) => span.year)).toEqual([
      2022, 2023, 2024,
    ]);
    expect(result.yearBlocks.map((block) => block.commits)).toEqual(
      history.years.map((year) => year.totals.commits),
    );
    expect(result.note).toBeNull();
    expect(result.plan.milestones.at(-1)?.kind).toBe("final");
  });

  it("handles a single year", () => {
    const history = makeHistory("ada", [makeYear(2021, steadyDays(2021, 4))]);
    const { plan, firstYear, lastYear } = planFromHistory(history, TODAY);
    expect(plan.years).toHaveLength(1);
    expect(firstYear).toBe(2021);
    expect(lastYear).toBe(2021);
    expect(plan.total).toBe(history.totals.commits);
  });

  it("scales a year with incomplete daily detail to its official total and says so", () => {
    const truncated = makeYear(2019, steadyDays(2019, 1), 2000);
    const history = makeHistory("ada", [
      makeYear(2018, steadyDays(2018, 2)),
      truncated,
    ]);
    const result = planFromHistory(history, TODAY);
    expect(truncated.reconciliation.matches).toBe(false);
    expect(result.incompleteYears).toEqual([2019]);
    expect(result.note).toBe(
      "Daily detail incomplete for 2019; totals are exact.",
    );
    expect(result.plan.total).toBe(history.totals.commits);
  });

  it("spreads a year with official commits but no daily detail", () => {
    const history = makeHistory("ada", [makeYear(2020, [], 365)]);
    const result = planFromHistory(history, TODAY);
    expect(result.plan.total).toBe(365);
    expect(result.incompleteYears).toEqual([2020]);
  });

  it("has an empty plan for zero contributions", () => {
    const none = planFromHistory(
      makeHistory("ghost", [makeYear(2024, [])]),
      TODAY,
    );
    expect(none.plan.total).toBe(0);
    expect(none.plan.slots).toEqual([]);
    expect(none.plan.milestones).toEqual([]);

    const noYears = planFromHistory(makeHistory("ghost", []), TODAY);
    expect(noYears.plan.total).toBe(0);
    expect(noYears.plan.days).toEqual([]);
    expect(noYears.firstYear).toBeNull();
    expect(noYears.lastYear).toBeNull();
  });

  it("includes quiet years between active ones", () => {
    const history = makeHistory("ada", [
      makeYear(2018, steadyDays(2018, 2)),
      makeYear(2021, steadyDays(2021, 2)),
    ]);
    const { plan } = planFromHistory(history, TODAY);
    expect(plan.years.map((span) => span.year)).toEqual([
      2018, 2019, 2020, 2021,
    ]);
  });

  it("stops the current year at today", () => {
    const history = makeHistory("ada", [
      makeYear(2025, steadyDays(2025, 2)),
      makeYear(2026, [{ date: "2026-03-01", commits: 5 }]),
    ]);
    const { plan } = planFromHistory(history, TODAY);
    expect(plan.days.at(-1)?.date).toBe("2026-10-17");
  });

  it("starts the first year at account creation", () => {
    const history = makeHistory(
      "ada",
      [makeYear(2020, [{ date: "2020-11-10", commits: 3 }])],
      "2020-10-01T00:00:00Z",
    );
    const { plan } = planFromHistory(history, TODAY);
    expect(plan.days[0]?.date).toBe("2020-10-01");
  });

  it("keeps a 16-year, 30k-commit profile bounded", () => {
    const years = Array.from({ length: 16 }, (_, index) => {
      const year = 2010 + index;
      return makeYear(year, steadyDays(year, 5, 1), 1900);
    });
    const history = makeHistory("torvalds", years);
    const { plan } = planFromHistory(history, TODAY);
    expect(plan.total).toBe(history.totals.commits);
    expect(plan.total).toBeGreaterThan(30_000);
    // Hits stay on the tempo grid: at most one per cell of the drawing window.
    expect(plan.slots.length).toBeLessThanOrEqual(
      Math.ceil(DRAW_SECONDS / GRID_SECONDS) + 1,
    );
    expect(
      plan.milestones.filter((milestone) => milestone.kind === "step").length,
    ).toBeLessThanOrEqual(MAX_STEP_MILESTONES);
    expect(plan.milestones.at(-1)?.time).toBeLessThanOrEqual(
      DRAW_SECONDS + GRID_SECONDS,
    );
  });
});
