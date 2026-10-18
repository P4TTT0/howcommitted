import { activeDays } from "./activity";
import type { DailyContributions } from "./types";

/** A month is quiet when its average is below this fraction of the mean monthly average. */
export const QUIET_MONTH_FRACTION = 0.5;

export type MonthStat = {
  /** 1 = January ... 12 = December. */
  month: number;
  /** Average contributions in this calendar month; null if it never occurs inside the span. */
  average: number | null;
  /** How many times this calendar month occurs inside the active span. */
  occurrences: number;
};

export type MonthShape = {
  months: MonthStat[];
  /** Month (1..12) with the highest average; ties go to the earliest in the calendar. */
  topMonth: number | null;
  /** Months (1..12) whose average is under half of the mean monthly average. */
  quietMonths: number[];
};

/**
 * Average contributions per calendar month. The active span runs from the
 * month of the first active day to the month of the last one, inclusive, so a
 * year in progress or a partial first year only counts the months it covers.
 * Each calendar month divides its total by how many times it occurs in that
 * span. Quiet months are those under `QUIET_MONTH_FRACTION` of the mean of the
 * monthly averages.
 */
export function monthShape(input: DailyContributions[]): MonthShape {
  const days = activeDays(input);
  const sums: number[] = Array.from({ length: 12 }, () => 0);
  const occurrences: number[] = Array.from({ length: 12 }, () => 0);
  const bump = (list: number[], month: number, by: number) => {
    list[month - 1] = (list[month - 1] ?? 0) + by;
  };

  const first = days[0];
  const last = days.at(-1);
  if (first && last) {
    let year = Number(first.date.slice(0, 4));
    let month = Number(first.date.slice(5, 7));
    const endYear = Number(last.date.slice(0, 4));
    const endMonth = Number(last.date.slice(5, 7));
    while (year < endYear || (year === endYear && month <= endMonth)) {
      bump(occurrences, month, 1);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    for (const { date, count } of days)
      bump(sums, Number(date.slice(5, 7)), count);
  }

  const months: MonthStat[] = sums.map((sum, i) => {
    const n = occurrences[i] ?? 0;
    return { month: i + 1, average: n === 0 ? null : sum / n, occurrences: n };
  });
  const known = months.flatMap((m) =>
    m.average === null ? [] : [{ month: m.month, average: m.average }],
  );
  let top = known[0];
  if (!top) return { months, topMonth: null, quietMonths: [] };

  const mean = known.reduce((sum, m) => sum + m.average, 0) / known.length;
  for (const m of known) {
    if (m.average > top.average) top = m;
  }
  return {
    months,
    topMonth: top.average > 0 ? top.month : null,
    quietMonths: known
      .filter((m) => m.average < mean * QUIET_MONTH_FRACTION)
      .map((m) => m.month),
  };
}
