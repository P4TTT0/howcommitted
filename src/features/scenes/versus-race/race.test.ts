import { describe, expect, it } from "vitest";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import {
  axisLabels,
  buildRace,
  buildRaces,
  dateAtIndex,
  dateLabel,
  dayReading,
  growthSlots,
  indexAtProgress,
  laneOrder,
  notThereYet,
  valuesAtIndex,
  whenLabel,
  yearLabel,
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

describe("laneOrder", () => {
  it("puts the largest running total first and breaks ties by lane", () => {
    expect(laneOrder([3, 9, 3, 0])).toEqual([1, 0, 2, 3]);
    expect(laneOrder([])).toEqual([]);
  });
});

describe("buildRaces", () => {
  const races = buildRaces([
    entry("ada", [
      [2021, 1],
      [2022, 1],
      [2023, 1],
    ]),
    entry("grace", [[2023, 2]]),
  ]);

  it("returns both axes with the same lanes, totals and peak", () => {
    if (!races) throw new Error("races expected");
    const { calendar, age } = races;
    expect(calendar.mode).toBe("calendar");
    expect(age.mode).toBe("age");
    expect(age.lanes.map((lane) => lane.login)).toEqual(["ada", "grace"]);
    expect(age.lanes.map((lane) => lane.total)).toEqual(
      calendar.lanes.map((lane) => lane.total),
    );
    expect(age.peak).toBe(calendar.peak);
  });

  it("starts both people at their own first year in same-age", () => {
    if (!races) throw new Error("races expected");
    const { calendar, age } = races;
    // Calendar: grace joins two years in. Same age: both start at index 0.
    expect(calendar.lanes[1]?.firstIndex).toBeGreaterThan(700);
    expect(age.lanes[1]?.firstIndex).toBe(0);
    expect(age.lanes[0]?.firstIndex).toBe(0);
    // Grace has a full first year of her own at the same age as ada's first.
    expect(age.lanes[1]?.series[0]).toBeGreaterThan(0);
    expect(age.lanes[0]?.series[0]).toBeGreaterThan(0);
    expect(age.length).toBe(calendar.length);
  });

  it("labels moments by calendar date or by year of life", () => {
    if (!races) throw new Error("races expected");
    expect(yearLabel(races.calendar, 0)).toBe("2021");
    expect(yearLabel(races.age, 0)).toBe("Year 1");
    expect(yearLabel(races.age, 400)).toBe("Year 2");
    expect(dateLabel(races.calendar, 0)).toBe("2021-01-01");
    expect(dateLabel(races.age, 0)).toBe("Day 1");
    expect(whenLabel(races.calendar, 31)).toBe("Feb 2021");
    expect(whenLabel(races.age, 400)).toBe("Year 2");
  });

  it("says a lane is not there yet before its first contribution", () => {
    if (!races) throw new Error("races expected");
    const grace = races.calendar.lanes[1];
    if (!grace) throw new Error("lane expected");
    expect(notThereYet(grace, 10, 0)).toBe(true);
    expect(notThereYet(grace, 10, 4)).toBe(false);
    expect(notThereYet(grace, races.calendar.length - 1, 0)).toBe(false);
    expect(notThereYet({ ...grace, firstIndex: null }, 10, 0)).toBe(false);
  });

  it("thins the axis labels and keeps the last one on the page", () => {
    if (!races) throw new Error("races expected");
    const labels = axisLabels(races.calendar);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(8);
    for (const mark of labels)
      expect(mark.startProgress).toBeLessThanOrEqual(0.9);
  });

  it("marks same-age years as Y1, Y2...", () => {
    if (!races) throw new Error("races expected");
    const marks = yearMarks(races.age);
    expect(marks[0]).toEqual({ label: "Y1", startProgress: 0 });
    expect(marks.length).toBeGreaterThanOrEqual(3);
  });

  it("finds crossings when two lines swap", () => {
    // Ada leads in 2022, then grace (3 a day) passes her in 2023.
    const swap = buildRaces([
      entry("ada", [
        [2022, 1],
        [2023, 1],
      ]),
      entry("grace", [
        [2022, 0],
        [2023, 9],
      ]),
    ]);
    expect(swap?.calendar.crossings.length).toBeGreaterThanOrEqual(1);
    expect(swap?.calendar.crossings[0]).toMatchObject({
      passer: 1,
      passed: 0,
    });
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
    expect(yearMarks(race)).toEqual([{ label: "2023", startProgress: 0 }]);
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
