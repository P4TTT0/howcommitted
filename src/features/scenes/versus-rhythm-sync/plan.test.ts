import { describe, expect, it } from "vitest";
import type { VersusProfile } from "@/features/versus/versusProfiles";
import { planRhythmSync } from "./plan";

const profile = (
  login: string,
  index: number,
  weekdays: number[],
): VersusProfile =>
  ({
    login,
    index,
    week: { weekdays, total: weekdays.reduce((sum, n) => sum + n, 0) },
  }) as VersusProfile;

const midweek = [4, 5, 5, 4, 2, 0, 0];
const alsoMidweek = [3, 4, 4, 3, 1, 0, 0];
const weekend = [0, 0, 0, 0, 1, 6, 5];

describe("planRhythmSync", () => {
  it("turns each developer's weekdays into shares of their own total", () => {
    const plan = planRhythmSync([
      profile("ada", 0, [2, 2, 0, 0, 0, 0, 0]),
      profile("grace", 1, midweek),
    ]);
    expect(plan?.people[0]?.percents).toEqual([50, 50, 0, 0, 0, 0, 0]);
    expect(plan?.scale).toBeCloseTo(0.5);
  });

  it("describes the closest and the furthest pair", () => {
    const plan = planRhythmSync([
      profile("ada", 0, midweek),
      profile("grace", 1, weekend),
      profile("linus", 2, alsoMidweek),
    ]);
    expect(plan?.cards.map((card) => card.label)).toEqual([
      "Closest weeks",
      "Furthest apart",
    ]);
    expect(plan?.cards[0]?.names).toBe("@ada + @linus");
    expect(plan?.cards[0]?.detail).toContain("Both peak on Tuesday.");
    expect(plan?.cards[1]?.detail).toContain("peaks on");
  });

  it("shows a single overlap card for two developers", () => {
    const plan = planRhythmSync([
      profile("ada", 0, midweek),
      profile("grace", 1, weekend),
    ]);
    expect(plan?.cards).toHaveLength(1);
    expect(plan?.cards[0]?.label).toBe("Weeks overlap");
  });

  it("is null with fewer than two active developers", () => {
    expect(
      planRhythmSync([
        profile("ada", 0, midweek),
        profile("grace", 1, [0, 0, 0, 0, 0, 0, 0]),
      ]),
    ).toBeNull();
  });
});
