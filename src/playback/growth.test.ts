import { describe, expect, it } from "vitest";
import { growthRuns } from "./growth";

const DRAW = 24;

/** Cumulative series from per-day amounts. */
function cumulativeOf(daily: readonly number[]): number[] {
  let sum = 0;
  return daily.map((amount) => {
    sum += amount;
    return sum;
  });
}

const weeks = (count: number, perDay: number) =>
  Array.from({ length: count * 7 }, () => perDay);

describe("growthRuns", () => {
  it("returns nothing when the total never rises", () => {
    expect(growthRuns(cumulativeOf(weeks(10, 0)), DRAW)).toEqual([]);
    expect(growthRuns([], DRAW)).toEqual([]);
  });

  it("keeps a flat stretch in the middle silent", () => {
    // 100 weeks: active, 50 idle weeks, active.
    const daily = [...weeks(25, 1), ...weeks(50, 0), ...weeks(25, 1)];
    const runs = growthRuns(cumulativeOf(daily), DRAW);
    expect(runs).toHaveLength(2);
    const [first, second] = runs;
    expect(first?.start).toBeCloseTo(0);
    expect((first?.start ?? 0) + (first?.duration ?? 0)).toBeCloseTo(6);
    expect(second?.start).toBeCloseTo(18);
    expect((second?.start ?? 0) + (second?.duration ?? 0)).toBeCloseTo(24);
  });

  it("joins consecutive active weeks into one run", () => {
    const runs = growthRuns(cumulativeOf(weeks(10, 1)), DRAW);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ start: 0, from: 0, to: 1 });
    expect(runs[0]?.duration).toBeCloseTo(DRAW);
  });

  it("bridges a gap too short to hear", () => {
    // One idle week of 1000 is 0.024 s, below the merge gap.
    const daily = [...weeks(500, 1), ...weeks(1, 0), ...weeks(499, 1)];
    expect(growthRuns(cumulativeOf(daily), DRAW)).toHaveLength(1);
  });

  it("plays an isolated short burst at the minimum duration", () => {
    // One active week in 520 idle weeks: 24 / 521 s is far below the minimum.
    const daily = [...weeks(260, 0), ...weeks(1, 3), ...weeks(260, 0)];
    const runs = growthRuns(cumulativeOf(daily), DRAW);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.duration).toBeCloseTo(0.2);
    expect(runs[0]).toMatchObject({ from: 0, to: 1 });
  });

  it("never stretches a short burst into the next run", () => {
    // Weeks of 1000 are 0.024 s: a one-week burst, then a 0.168 s gap (above
    // the merge gap, below the minimum), then a long run.
    const daily = [
      ...weeks(100, 0),
      ...weeks(1, 1),
      ...weeks(7, 0),
      ...weeks(892, 1),
    ];
    const [burst, run] = growthRuns(cumulativeOf(daily), DRAW);
    expect(burst && run).toBeTruthy();
    expect((burst?.start ?? 0) + (burst?.duration ?? 0)).toBeLessThanOrEqual(
      run?.start ?? 0,
    );
  });

  it("never stretches a burst in the last week past the draw", () => {
    const daily = [...weeks(520, 0), ...weeks(1, 3)];
    const [burst] = growthRuns(cumulativeOf(daily), DRAW);
    expect((burst?.start ?? 0) + (burst?.duration ?? 0)).toBeCloseTo(DRAW);
  });

  it("climbs monotonically and ends at the final total", () => {
    const daily = [...weeks(20, 1), ...weeks(40, 0), ...weeks(20, 2)];
    const runs = growthRuns(cumulativeOf(daily), DRAW);
    expect(runs).toHaveLength(2);
    expect(runs[0]?.from).toBe(0);
    expect(runs[0]?.to).toBeCloseTo(140 / 420);
    expect(runs[1]?.from).toBeCloseTo(140 / 420);
    expect(runs.at(-1)?.to).toBe(1);
    for (const run of runs) expect(run.to).toBeGreaterThan(run.from);
  });

  it("gives an unattributed step its own run", () => {
    // Idle history with one big jump on a single day.
    const daily = Array.from({ length: 700 }, () => 0);
    daily[350] = 500;
    const runs = growthRuns(cumulativeOf(daily), DRAW);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ from: 0, to: 1 });
    expect(runs[0]?.start).toBeCloseTo((350 / 700) * DRAW, 0);
  });
});
