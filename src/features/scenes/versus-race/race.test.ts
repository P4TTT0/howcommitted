import { describe, expect, it } from "vitest";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import {
  activePass,
  buildRace,
  dateAtIndex,
  dayReading,
  growthSlots,
  indexAtProgress,
  LEADER_SHARE,
  laneOrder,
  MAX_TICKS,
  niceTicks,
  passesLabel,
  scaleFor,
  tickLabel,
  valuesAtIndex,
  yearMarks,
  yearStartIndex,
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
    expect(grace?.firstIndex).toBeGreaterThan(300);
    expect(grace?.series.at(-1)).toBe(grace?.total);
    expect(ada?.series.at(-1)).toBe(ada?.total);
    expect([race.firstYear, race.lastYear]).toEqual([2022, 2023]);
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

describe("laneOrder", () => {
  it("puts the largest running total first and breaks ties by lane", () => {
    expect(laneOrder([3, 9, 3, 0])).toEqual([1, 0, 2, 3]);
    expect(laneOrder([])).toEqual([]);
  });
});

describe("the scale", () => {
  it("follows the leader, who sits at about two thirds of the width", () => {
    const scale = scaleFor([100, 4000, 250]);
    expect(4000 / scale).toBeCloseTo(LEADER_SHARE, 5);
    expect(scaleFor([8000, 100])).toBeGreaterThan(scale);
  });

  it("grows smoothly with the leader and never reaches zero", () => {
    expect(scaleFor([0, 0])).toBeGreaterThan(0);
    let previous = scaleFor([0]);
    for (let total = 0; total <= 5000; total += 50) {
      const next = scaleFor([total, total / 2]);
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it("draws round gridlines that rescale with it", () => {
    expect(niceTicks(6250).map((tick) => tick.label)).toEqual([
      "0",
      "2k",
      "4k",
    ]);
    expect(niceTicks(1000).map((tick) => tick.label)).toEqual([
      "0",
      "250",
      "500",
      "750",
    ]);
    for (const scale of [20, 333, 1500, 62_000, 31_000_000]) {
      const ticks = niceTicks(scale);
      expect(ticks.length).toBeLessThanOrEqual(MAX_TICKS);
      expect(ticks[0]?.value).toBe(0);
      for (const tick of ticks) {
        expect(tick.x).toBeGreaterThanOrEqual(0);
        expect(tick.x).toBeLessThanOrEqual(1);
      }
    }
  });

  it("labels big numbers compactly", () => {
    expect(tickLabel(0)).toBe("0");
    expect(tickLabel(2500)).toBe("2.5k");
    expect(tickLabel(12_000_000)).toBe("12M");
  });
});

describe("passes", () => {
  // Ada leads through 2022, then grace (3 a day) passes her in 2023.
  const race = buildRace([
    entry("ada", [
      [2022, 1],
      [2023, 1],
    ]),
    entry("grace", [
      [2022, 0],
      [2023, 3],
    ]),
  ]);

  it("finds the crossing and names who passed whom", () => {
    const crossing = race?.crossings[0];
    expect(crossing).toMatchObject({ passer: 1, passed: 0 });
    expect(crossing?.index).toBeGreaterThan(365);
  });

  it("announces a pass only around the moment it happens", () => {
    if (!race) throw new Error("race expected");
    const at = race.crossings[0]?.index ?? 0;
    expect(activePass(race, at - 1, 14)).toBeNull();
    expect(activePass(race, at, 14)).toEqual(race.crossings[0]);
    expect(activePass(race, at + 13, 14)).toEqual(race.crossings[0]);
    expect(activePass(race, at + 14, 14)).toBeNull();
  });

  it("swaps the places exactly when the lines cross", () => {
    if (!race) throw new Error("race expected");
    const at = race.crossings[0]?.index ?? 0;
    expect(laneOrder(valuesAtIndex(race, at - 1))).toEqual([0, 1]);
    expect(laneOrder(valuesAtIndex(race, at))).toEqual([1, 0]);
  });

  it("counts them in the singular and plural", () => {
    expect(passesLabel(0)).toBe("0 passes");
    expect(passesLabel(1)).toBe("1 pass");
    expect(passesLabel(1200)).toBe("1,200 passes");
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

  it("marks each year once and finds where a year starts", () => {
    if (!race) throw new Error("race expected");
    expect(yearMarks(race)).toEqual([{ label: "2023", startProgress: 0 }]);
    expect(yearStartIndex(race, 2023)).toBe(0);
    expect(yearStartIndex(race, 2030)).toBe(race.length - 1);
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
