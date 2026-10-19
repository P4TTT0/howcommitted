import { describe, expect, it } from "vitest";
import { planFromHistory } from "@/features/sequencer/model/historyPlan";
import type { VersusEntry } from "@/features/sequencer/types";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "@/test-support/historyFixture";
import {
  buildSharedDays,
  dateTitle,
  dayDetail,
  everyoneLabel,
  groupsShown,
  MONTH_BLOCK,
  monthColumns,
  monthSlots,
  weekSlots,
} from "./plan";

const today = new Date("2030-01-01T00:00:00Z");

function entry(login: string, years: [number, number, number][]): VersusEntry {
  const history = makeHistory(
    login,
    years.map(([year, count, every]) =>
      makeYear(year, steadyDays(year, count, every)),
    ),
  );
  return { login, model: planFromHistory(history, today) };
}

function placed(slots: (number | null)[]): number[] {
  return slots.flatMap((slot) => (slot === null ? [] : [slot]));
}

describe("week strip slots", () => {
  it("puts January 1st on its weekday, Monday first", () => {
    // 2024-01-01 is a Monday, 2023-01-01 a Sunday.
    expect(weekSlots(2024, 366)[0]).toBe(0);
    expect(weekSlots(2023, 365)[6]).toBe(0);
    expect(weekSlots(2023, 365)[5]).toBeNull();
  });

  it("places every day exactly once, even in the longest layout", () => {
    // 2012 is a leap year that starts on a Sunday: it needs the 54th column.
    for (const year of [2023, 2024, 2012]) {
      const days = year % 4 === 0 ? 366 : 365;
      expect(placed(weekSlots(year, days))).toEqual(
        Array.from({ length: days }, (_, day) => day),
      );
    }
  });

  it("leaves out days that do not exist yet", () => {
    expect(placed(weekSlots(2024, 10))).toHaveLength(10);
  });
});

describe("month block slots", () => {
  it("places every day once, inside its own month block", () => {
    const slots = monthSlots(2024, 366);
    expect(placed(slots).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 366 }, (_, day) => day),
    );
    // March 15, 2024 is day 74 and sits in block 2 (a Friday: column 4).
    const slot = slots.indexOf(74);
    expect(Math.floor(slot / MONTH_BLOCK)).toBe(2);
    expect(slot % 7).toBe(4);
  });
});

describe("monthColumns", () => {
  it("starts January in the first column and moves forward", () => {
    const columns = monthColumns(2024);
    expect(columns[0]).toBe(0);
    expect(columns[1]).toBe(4);
    expect([...columns].sort((a, b) => a - b)).toEqual(columns);
  });
});

describe("copy", () => {
  it("titles a date and names who showed up", () => {
    expect(dateTitle("2024-03-15")).toBe("Fri, Mar 15");
    expect(dayDetail({ date: "x", people: [] }, ["ada"])).toBe(
      "Nobody that day",
    );
    expect(
      dayDetail({ date: "x", people: [0, 2] }, ["ada", "g", "linus"]),
    ).toBe("@ada · @linus");
  });

  it("words the everyone label for two to five", () => {
    expect(everyoneLabel(2)).toBe("Both showed up");
    expect(everyoneLabel(3)).toBe("All three showed up");
    expect(everyoneLabel(5)).toBe("All five showed up");
  });
});

describe("buildSharedDays", () => {
  const model = buildSharedDays([
    entry("ada", [
      [2022, 1, 2],
      [2023, 1, 2],
    ]),
    entry("grace", [[2023, 1, 3]]),
  ]);

  it("covers the years from the first contribution to the last day", () => {
    expect(model?.years).toEqual([2022, 2023]);
    expect(model?.logins).toEqual(["ada", "grace"]);
  });

  it("opens on the latest year in which they showed up on the same day", () => {
    expect(model?.defaultYear).toBe(2023);
  });

  it("counts a year's days, the days together and each person's days", () => {
    const year = model?.yearData(2023);
    expect(year?.days).toHaveLength(365);
    // Every 6th day both contribute (multiples of 2 and 3).
    expect(year?.stats.everyone).toBe(61);
    expect(year?.together).toBe(61);
    expect(year?.stats.perPerson).toEqual([183, 122]);
    expect(year?.stats.longestRun).toBe(1);
    expect(model?.yearData(2023)).toBe(year);
  });

  it("is null when nobody contributed", () => {
    expect(
      buildSharedDays([
        { login: "zed", model: planFromHistory(makeHistory("zed", []), today) },
      ]),
    ).toBeNull();
  });
});

describe("groupsShown", () => {
  it("reveals groups as progress runs from 0 to 1", () => {
    expect(groupsShown(0, 12)).toBe(0);
    expect(groupsShown(0.5, 12)).toBe(6);
    expect(groupsShown(1, 12)).toBe(12);
    expect(groupsShown(2, 12)).toBe(12);
  });
});
