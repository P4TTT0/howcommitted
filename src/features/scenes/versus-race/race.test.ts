import { describe, expect, it } from "vitest";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import {
  buildRace,
  dateAtIndex,
  dayReading,
  growthSlots,
  indexAtProgress,
  valuesAtIndex,
  yearMarks,
} from "./race";

const today = new Date("2030-01-01T00:00:00Z");

function entry(login: string, years: [number, number][]) {
  const history = makeHistory(
    login,
    years.map(([year, count]) => makeYear(year, steadyDays(year, count))),
  );
  return { login, plan: planFromHistory(history, today).plan };
}

describe("buildRace", () => {
  it("keeps the order the developers were added in", () => {
    const race = buildRace([
      entry("zed", [[2023, 1]]),
      entry("ada", [[2023, 9]]),
    ]);
    expect(race?.lanes.map((lane) => lane.login)).toEqual(["zed", "ada"]);
  });

  it("aligns everyone on one shared axis", () => {
    const race = buildRace([
      entry("ada", [
        [2022, 1],
        [2023, 1],
      ]),
      entry("grace", [[2023, 2]]),
    ]);
    expect(race).not.toBeNull();
    if (!race) return;
    expect(dateAtIndex(race, 0)).toBe("2022-01-01");
    expect(race.length).toBe(730);
    const [ada, grace] = race.lanes;
    // Grace has not started in 2022: zero, then she joins in 2023.
    expect(grace?.series[100]).toBe(0);
    expect(grace?.series.at(-1)).toBe(grace?.total);
    expect(ada?.series.at(-1)).toBe(ada?.total);
    expect(race.peak).toBe(Math.max(ada?.total ?? 0, grace?.total ?? 0));
  });

  it("holds a lane's total after its last day", () => {
    const race = buildRace([
      entry("ada", [[2022, 1]]),
      entry("grace", [
        [2022, 1],
        [2023, 1],
      ]),
    ]);
    const ada = race?.lanes[0];
    expect(ada?.series.at(-1)).toBe(ada?.total);
    expect(ada?.series.at(-200)).toBe(ada?.total);
  });

  it("is null when nobody contributed", () => {
    const empty = {
      login: "ada",
      plan: planFromHistory(makeHistory("ada", []), today).plan,
    };
    expect(buildRace([empty])).toBeNull();
  });

  it("never decreases along the axis", () => {
    const race = buildRace([entry("ada", [[2023, 3]])]);
    const series = race?.lanes[0]?.series ?? [];
    expect(series.every((v, i) => i === 0 || v >= (series[i - 1] ?? 0))).toBe(
      true,
    );
  });
});

describe("race readings", () => {
  const race = buildRace([
    entry("ada", [[2023, 1]]),
    entry("grace", [[2023, 2]]),
  ]);

  it("maps progress to a day and reads every lane", () => {
    if (!race) throw new Error("race expected");
    expect(indexAtProgress(race, 0)).toBe(0);
    expect(indexAtProgress(race, 1)).toBe(race.length - 1);
    expect(valuesAtIndex(race, race.length - 1)).toEqual(
      race.lanes.map((lane) => lane.total),
    );
    expect(dayReading(race, 0)).toContain("@ada 1, @grace 2");
  });

  it("marks each year once", () => {
    if (!race) throw new Error("race expected");
    expect(yearMarks(race)).toEqual([{ year: 2023, startProgress: 0 }]);
  });

  it("grows lanes on the tick grid, only where they gained", () => {
    if (!race) throw new Error("race expected");
    const slots = growthSlots(race);
    expect(slots[0]?.time).toBe(0);
    expect(slots.some((slot) => slot.lanes.length > 0)).toBe(true);
    for (const slot of slots) {
      expect(slot.lanes).toEqual([...slot.lanes].sort((a, b) => a - b));
    }
  });
});
