import { describe, expect, it } from "vitest";
import { labSceneData } from "@/features/experience/labData";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import { weekShapeScene } from "./index";
import {
  barDetail,
  compactCount,
  GRID_SECONDS,
  growthAt,
  planWeekShape,
  rhythmLine,
  rhythmProgressAt,
} from "./plan";

// 2024-01-01 is a Monday; every day with 2 contributions.
const history = makeHistory("ada", [makeYear(2024, steadyDays(2024, 2, 1))]);

describe("planWeekShape", () => {
  it("returns null without activity", () => {
    expect(planWeekShape(makeHistory("ada", [makeYear(2024, [])]))).toBeNull();
  });

  it("builds seven bars Monday first with weekends flagged", () => {
    const plan = planWeekShape(history);
    expect(plan?.bars.map((bar) => bar.short)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(plan?.bars.map((bar) => bar.weekend)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(plan?.firstYear).toBe(2024);
    expect(plan?.archetype).toBe("Steady all week");
  });

  it("scales the tallest bar to 1 and keeps shares in percent", () => {
    const plan = planWeekShape(history);
    const tallest = Math.max(...(plan?.bars.map((bar) => bar.ratio) ?? []));
    expect(tallest).toBe(1);
    const sum = plan?.bars.reduce((total, bar) => total + bar.percent, 0) ?? 0;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(3);
  });

  it("puts starts on the grid, in order, with rising pitch", () => {
    const plan = planWeekShape(history);
    const bars = plan?.bars ?? [];
    for (const bar of bars) {
      expect(bar.start / GRID_SECONDS).toBeCloseTo(
        Math.round(bar.start / GRID_SECONDS),
      );
    }
    expect(bars.map((bar) => bar.degree)).toEqual(
      [...bars.map((bar) => bar.degree)].sort((a, b) => a - b),
    );
    expect(plan?.duration).toBeGreaterThan(plan?.rhythmStart ?? 0);
  });

  it("words the rhythm line and a bar detail", () => {
    const plan = planWeekShape(history);
    expect(plan && rhythmLine(plan)).toMatch(
      /^Your busiest 10% of days hold \d+% of your contributions\. Active in \d+% of weeks\.$/,
    );
    const monday = plan?.bars[0];
    expect(monday && barDetail(monday)).toMatch(
      /^\d[\d,]* contributions · \d+% of all$/,
    );
  });
});

describe("growth over time", () => {
  const bar = { start: 1, land: 2 };
  it("runs from 0 to 1 and never overshoots", () => {
    expect(growthAt(bar, 0.5, false)).toBe(0);
    expect(growthAt(bar, 2, false)).toBe(1);
    const mid = growthAt(bar, 1.5, false);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
  });

  it("shows the final state under reduced motion", () => {
    expect(growthAt(bar, 0, true)).toBe(1);
    expect(rhythmProgressAt({ rhythmStart: 5 }, 0, true)).toBe(1);
    expect(rhythmProgressAt({ rhythmStart: 5 }, 0, false)).toBe(0);
  });
});

describe("weekShapeScene", () => {
  it("is skipped without a history (the lab)", () => {
    const data = labSceneData();
    expect(weekShapeScene.create({ ...data, history: null })).toBeNull();
  });

  it("plays for the plan duration", () => {
    const data = labSceneData();
    const instance = weekShapeScene.create({ ...data, history });
    expect(instance?.duration).toBe(planWeekShape(history)?.duration);
  });
});

describe("compactCount", () => {
  it("keeps bar labels short", () => {
    expect(compactCount(950)).toBe("950");
    expect(compactCount(1234)).toBe("1.2K");
    expect(compactCount(52_000_000)).toBe("52M");
  });
});
