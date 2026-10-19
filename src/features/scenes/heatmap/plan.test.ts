import { describe, expect, it } from "vitest";
import type { HeatmapCell } from "@/domain/heatmap";
import {
  EMPTY_WEEK_DB,
  FADE_SECONDS,
  hoverLevel,
  planReveal,
  planRows,
  positionAfterKey,
  tint,
  tipDetail,
  tipTitle,
  WEEKS,
  weekDetail,
  weeklyTotals,
  weekProgress,
  weekReading,
} from "./plan";

function cell(
  date: string,
  week: number,
  contributions: number,
  weekday = 3,
): HeatmapCell {
  return { date, week, weekday, contributions, level: 1 };
}

/** One cell per week of a 2023 whose first week starts on Jan 1. */
function fullYear(year: number, each: number): HeatmapCell[] {
  return Array.from({ length: 52 }, (_, week) => {
    const ms = Date.UTC(year, 0, 1 + week * 7);
    return cell(new Date(ms).toISOString().slice(0, 10), week, each);
  });
}

const TODAY = new Date(Date.UTC(2025, 5, 15));

describe("planRows", () => {
  const rows = planRows(
    [
      { year: 2023, totalContributions: 520, heatmap: fullYear(2023, 10) },
      { year: 2024, totalContributions: 260, heatmap: fullYear(2024, 5) },
      {
        year: 2025,
        totalContributions: 90,
        heatmap: fullYear(2025, 3).slice(0, 24),
      },
    ],
    TODAY,
  );

  it("makes a row of 53 weeks per year, with the calendar total", () => {
    expect(rows.map((row) => [row.year, row.total, row.weeks.length])).toEqual([
      [2023, 520, WEEKS],
      [2024, 260, WEEKS],
      [2025, 90, WEEKS],
    ]);
  });

  it("keeps the timeline's palette position and labels the year in progress", () => {
    expect(rows.map((row) => row.colorIndex)).toEqual([0, 1, 2]);
    expect(rows.map((row) => row.label)).toEqual([
      "2023",
      "2024",
      "2025 so far",
    ]);
    expect(rows.map((row) => row.inProgress)).toEqual([false, false, true]);
  });

  it("draws weeks that have not started as future, only in the year in progress", () => {
    expect(rows[0]?.weeks[52]?.state).toBe("absent");
    expect(rows[1]?.weeks[10]?.state).toBe("past");
    expect(rows[2]?.weeks[0]?.state).toBe("past");
    expect(rows[2]?.weeks[30]?.state).toBe("future");
    expect(rows[2]?.weeks[52]?.state).toBe("future");
  });

  it("shares one scale between years: busier weeks reach higher levels", () => {
    const level = (row: number) => rows[row]?.weeks[5]?.level ?? 0;
    expect(level(0)).toBeGreaterThan(level(1));
    expect(level(1)).toBeGreaterThanOrEqual(level(2));
    expect(level(0)).toBeGreaterThan(level(2));
    expect(level(0)).toBeLessThanOrEqual(4);
    expect(level(2)).toBeGreaterThanOrEqual(1);
  });

  it("leaves a quiet week empty", () => {
    const quiet = planRows(
      [
        {
          year: 2024,
          totalContributions: 5,
          heatmap: [cell("2024-01-02", 0, 5), cell("2024-01-09", 1, 0)],
        },
      ],
      TODAY,
    );
    expect(quiet[0]?.weeks[1]).toMatchObject({ state: "past", level: 0 });
    expect(quiet[0]?.weeks[0]?.level).toBe(4);
  });
});

describe("planReveal", () => {
  const totals = Array.from({ length: WEEKS }, (_, week) => week);
  const plan = planReveal(totals);

  it("reveals weeks in order on the grid", () => {
    expect(plan.weeks).toBe(WEEKS);
    expect(plan.weekTimes).toEqual([...plan.weekTimes].sort((a, b) => a - b));
    expect(plan.duration).toBeGreaterThan(plan.weekTimes.at(-1) ?? 0);
  });

  it("pops once per column, as it lands and not as it starts", () => {
    expect(plan.pops).toHaveLength(plan.weeks);
    plan.pops.forEach(({ time }, week) => {
      const start = plan.weekTimes[week] ?? 0;
      expect(time).toBeGreaterThan(start);
      expect(time).toBeLessThanOrEqual(start + FADE_SECONDS);
    });
  });

  it("softens the pop of weeks without contributions", () => {
    plan.pops.forEach(({ db }, week) => {
      expect(db).toBe((totals[week] ?? 0) > 0 ? 0 : EMPTY_WEEK_DB);
    });
    const silent = planReveal(new Array<number>(WEEKS).fill(0));
    expect(silent.pops).toHaveLength(WEEKS);
    for (const { db } of silent.pops) expect(db).toBeLessThan(0);
  });

  it("sums every year into each week column", () => {
    const rows = planRows(
      [
        {
          year: 2023,
          totalContributions: 4,
          heatmap: [cell("2023-01-03", 0, 4)],
        },
        {
          year: 2024,
          totalContributions: 6,
          heatmap: [cell("2024-01-02", 0, 6)],
        },
      ],
      TODAY,
    );
    expect(weeklyTotals(rows)[0]).toBe(10);
  });
});

describe("weekProgress", () => {
  it("is 0 before, 1 after, and instant with reduced motion", () => {
    expect(weekProgress(1, 0.5, false)).toBe(0);
    expect(weekProgress(1, 5, false)).toBe(1);
    expect(weekProgress(1, 1.01, true)).toBe(1);
  });
});

describe("positionAfterKey", () => {
  const rows = planRows(
    [
      {
        year: 2023,
        totalContributions: 3,
        heatmap: fullYear(2023, 1).slice(0, 3),
      },
      {
        year: 2024,
        totalContributions: 3,
        heatmap: fullYear(2024, 1).slice(0, 3),
      },
    ],
    TODAY,
  );
  const at = (row: number, week: number) => ({ row, week });

  it("moves a week or a year and stays on readable weeks", () => {
    expect(positionAfterKey("ArrowRight", at(0, 0), rows)).toEqual(at(0, 1));
    expect(positionAfterKey("ArrowLeft", at(0, 0), rows)).toEqual(at(0, 0));
    expect(positionAfterKey("ArrowDown", at(0, 1), rows)).toEqual(at(1, 1));
    expect(positionAfterKey("ArrowUp", at(0, 1), rows)).toEqual(at(0, 1));
    // Week 3 has no days: the walk stops at the last readable one.
    expect(positionAfterKey("ArrowRight", at(0, 2), rows)).toEqual(at(0, 2));
  });

  it("jumps to the first and last readable week", () => {
    expect(positionAfterKey("Home", at(1, 2), rows)).toEqual(at(0, 0));
    expect(positionAfterKey("End", at(0, 0), rows)).toEqual(at(1, 2));
    expect(positionAfterKey("a", at(0, 0), rows)).toBeNull();
  });
});

describe("readings", () => {
  it("names the year and week, and says contributions, never commits", () => {
    expect(weekDetail(12)).toBe("12 contributions that week");
    expect(weekDetail(1)).toBe("1 contribution that week");
    const text = weekReading(
      { year: 2022 },
      {
        week: 13,
        contributions: 1234,
        level: 4,
        state: "past",
        from: "2022-04-03",
        to: "2022-04-09",
      },
    );
    expect(text).toBe("2022 · week 14: 1,234 contributions that week");
  });
});

describe("tooltip text", () => {
  it("says contributions and the real dates of the week", () => {
    expect(tipTitle(1234)).toBe("1,234 contributions");
    expect(tipTitle(1)).toBe("1 contribution");
    expect(
      tipDetail({ year: 2024 }, { from: "2024-04-08", to: "2024-04-14" }),
    ).toBe("2024 · Apr 8 – Apr 14");
  });

  it("carries the first and last day of each column", () => {
    const [row] = planRows(
      [{ year: 2023, totalContributions: 520, heatmap: fullYear(2023, 10) }],
      TODAY,
    );
    expect(row?.weeks[1]).toMatchObject({
      from: "2023-01-08",
      to: "2023-01-08",
    });
  });
});

describe("tint", () => {
  it("turns a hex color into rgb with an alpha", () => {
    expect(tint("#1F3BFF", 0.55)).toBe("rgb(31 59 255 / 0.55)");
  });
});

describe("hoverLevel", () => {
  it("maps the cell level 0..4 onto 0..1", () => {
    expect(hoverLevel({ level: 0 })).toBe(0);
    expect(hoverLevel({ level: 2 })).toBe(0.5);
    expect(hoverLevel({ level: 4 })).toBe(1);
  });
});
