import { describe, expect, it } from "vitest";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { incompleteDetailNote, planFromHistory } from "./historyPlan";
import {
  DRAW_SECONDS,
  GRID_SECONDS,
  MAX_STEP_MILESTONES,
  milestoneSchedule,
  stepCueTimes,
} from "./plan";

const TODAY = new Date("2026-10-17T12:00:00Z");

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

  it("says how many commits a single year left unattributed", () => {
    expect(incompleteDetailNote([{ year: 2019, unattributed: 1880 }])).toBe(
      "1,880 commits in 2019 are not attributed to a day; yearly totals are exact.",
    );
    expect(incompleteDetailNote([{ year: 2019, unattributed: 1 }])).toBe(
      "1 commit in 2019 is not attributed to a day; yearly totals are exact.",
    );
  });

  it("flags daily detail above the yearly total, or a bare mismatch", () => {
    expect(incompleteDetailNote([{ year: 2019, unattributed: -5 }])).toBe(
      "Daily detail for 2019 exceeds its yearly total by 5; yearly totals are exact.",
    );
    expect(incompleteDetailNote([{ year: 2019, unattributed: 0 }])).toBe(
      "Daily detail incomplete for 2019; yearly totals are exact.",
    );
  });

  it("counts several years instead of listing them", () => {
    const gaps = [2015, 2016, 2017].map((year) => ({ year, unattributed: 3 }));
    expect(incompleteDetailNote(gaps)).toBe(
      "Daily detail incomplete for 3 years; yearly totals are exact.",
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

  const dailySum = (plan: { days: { commits: number }[] }) =>
    plan.days.reduce((total, day) => total + day.commits, 0);

  it("shows missing commits as one explicit step at the end of the year", () => {
    const truncated = makeYear(2019, steadyDays(2019, 1), 2000);
    const history = makeHistory("ada", [
      makeYear(2018, steadyDays(2018, 2)),
      truncated,
    ]);
    const result = planFromHistory(history, TODAY);
    const { plan } = result;
    expect(truncated.reconciliation.matches).toBe(false);

    // Days stay real: 122 commits on the days of 2019, nothing invented.
    const daysOf2019 = plan.days.filter((d) => d.date.startsWith("2019"));
    expect(daysOf2019.reduce((t, d) => t + d.commits, 0)).toBe(
      truncated.reconciliation.summed,
    );

    const [step] = plan.steps;
    expect(plan.steps).toHaveLength(1);
    expect(step?.year).toBe(2019);
    expect(step?.amount).toBe(2000 - truncated.reconciliation.summed);
    expect(plan.days[step?.dayIndex ?? 0]?.date).toBe("2019-12-31");
    expect(step?.to).toBe((step?.from ?? 0) + (step?.amount ?? 0));

    expect(result.incompleteYears).toEqual([2019]);
    expect(result.note).toBe(
      "1,878 commits in 2019 are not attributed to a day; yearly totals are exact.",
    );
    expect(plan.total).toBe(history.totals.commits);
    expect(plan.cumulative.at(-1)).toBe(history.totals.commits);
  });

  it("never scales down when daily detail exceeds the yearly total", () => {
    const over = makeYear(2020, steadyDays(2020, 2), 100);
    const history = makeHistory("ada", [over]);
    const result = planFromHistory(history, TODAY);
    expect(dailySum(result.plan)).toBe(over.reconciliation.summed);
    const [step] = result.plan.steps;
    expect(step?.amount).toBe(100 - over.reconciliation.summed);
    expect(result.plan.total).toBe(100);
    expect(result.plan.cumulative.at(-1)).toBe(100);
    expect(result.incompleteYears).toEqual([2020]);
    expect(result.note).toContain("exceeds its yearly total");
    // A step that takes commits away is never celebrated with a cue.
    expect(stepCueTimes(result.plan)).toEqual([]);
  });

  it("makes a year with no daily detail one unattributed step, not a ramp", () => {
    const history = makeHistory("ada", [makeYear(2020, [], 365)]);
    const result = planFromHistory(history, TODAY);
    expect(dailySum(result.plan)).toBe(0);
    expect(result.plan.steps).toHaveLength(1);
    expect(result.plan.steps[0]?.amount).toBe(365);
    expect(result.plan.slots).toEqual([]);
    expect(result.plan.total).toBe(365);
    expect(result.incompleteYears).toEqual([2020]);
  });

  it("notices a mismatch the API reconciliation missed", () => {
    // Reconciliation says the year matches, yet one entry is dated outside
    // the year and cannot be placed on any of its days.
    const stray = makeYear(2020, [
      { date: "2020-03-01", commits: 2 },
      { date: "2021-01-05", commits: 3 },
    ]);
    expect(stray.reconciliation.matches).toBe(true);
    const result = planFromHistory(makeHistory("ada", [stray]), TODAY);
    expect(result.plan.steps[0]?.amount).toBe(3);
    expect(result.incompleteYears).toEqual([2020]);
    expect(result.note).toBe(
      "3 commits in 2020 are not attributed to a day; yearly totals are exact.",
    );
    expect(result.plan.total).toBe(5);
  });

  it("plays one soft cue per growing step, on the grid", () => {
    const history = makeHistory("ada", [
      makeYear(2018, steadyDays(2018, 1), 500),
      makeYear(2019, steadyDays(2019, 1), 100),
      makeYear(2020, steadyDays(2020, 1), 600),
    ]);
    const { plan } = planFromHistory(history, TODAY);
    const growing = plan.steps.filter((step) => step.amount > 0);
    expect(growing).toHaveLength(2);
    const times = stepCueTimes(plan);
    const payoffs = new Set(plan.milestones.map((m) => m.time));
    expect(times.length).toBe(
      growing.filter((s) => !payoffs.has(s.time)).length,
    );
    expect(new Set(times).size).toBe(times.length);
    for (const time of times) {
      expect(
        Math.abs(time / GRID_SECONDS - Math.round(time / GRID_SECONDS)),
      ).toBeLessThan(1e-6);
    }
  });

  it("fires a milestone crossed inside a step at the step", () => {
    const history = makeHistory("ada", [
      makeYear(2020, [{ date: "2020-02-01", commits: 10 }], 2600),
      makeYear(2021, steadyDays(2021, 1)),
    ]);
    const { plan } = planFromHistory(history, TODAY);
    const step = plan.steps[0];
    const crossed = plan.milestones.filter((m) => m.kind === "step");
    expect(crossed.length).toBeGreaterThan(0);
    expect(crossed[0]?.time).toBe(step?.time);
  });

  it("spreads nothing across the year when the whole year is one step", () => {
    const history = makeHistory("ada", [makeYear(2020, [], 365)]);
    const { plan } = planFromHistory(history, TODAY);
    expect(plan.days.every((day) => day.commits === 0)).toBe(true);
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
