import { type MonthShape, monthShape } from "@/domain/month-shape";
import type { DailyContributions } from "@/domain/types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** One bar of the month strip. */
export type MonthBar = {
  /** 1 = January ... 12 = December. */
  month: number;
  /** First letter, for the label under the bar. */
  letter: string;
  /** 0..1 of the busiest month's average. */
  ratio: number;
  /** The month with the highest average: drawn in the accent color. */
  isTop: boolean;
  /** Under half of the mean monthly average: drawn dashed. */
  isQuiet: boolean;
};

export type MonthStrip = {
  bars: MonthBar[];
  /** "Spring builder. March is your month." */
  headline: string;
  /** "Average per month across every year. August and December run quiet." */
  detail: string;
};

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/**
 * The calendar season of a month, northern-hemisphere convention:
 * December to February winter, March to May spring, June to August summer,
 * September to November autumn. The data has no location, so the season is
 * only a way to name a stretch of the calendar, never a claim about weather.
 */
export function seasonOf(month: number): string {
  if (month === 12 || month <= 2) return "Winter";
  if (month <= 5) return "Spring";
  if (month <= 8) return "Summer";
  return "Autumn";
}

/** "August", "August and December", "April, August and December". */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Quiet months are only named when there are a few; more would be noise. */
const MAX_NAMED_QUIET = 3;

/**
 * The month strip, or null when the data does not support it.
 *
 * The rule: it needs a top month with something in it, and every calendar
 * month must have occurred at least once in the active span (a year of
 * history or more). With less, a month's average would rest on nothing and
 * "your month" would be a guess. `monthShape` does the maths: average per
 * calendar month over the months the span covers, quiet = under half of the
 * mean monthly average.
 */
export function planMonthStrip(
  days: DailyContributions[],
  shape: MonthShape = monthShape(days),
): MonthStrip | null {
  const { months, topMonth, quietMonths } = shape;
  if (topMonth === null) return null;
  if (months.some((stat) => stat.occurrences === 0)) return null;

  const peak = Math.max(1, ...months.map((stat) => stat.average ?? 0));
  const bars = months.map(
    (stat): MonthBar => ({
      month: stat.month,
      letter: monthName(stat.month).slice(0, 1),
      ratio: (stat.average ?? 0) / peak,
      isTop: stat.month === topMonth,
      isQuiet: quietMonths.includes(stat.month),
    }),
  );

  const quiet =
    quietMonths.length > 0 && quietMonths.length <= MAX_NAMED_QUIET
      ? ` ${joinNames(quietMonths.map(monthName))} run quiet.`
      : "";
  return {
    bars,
    headline: `${seasonOf(topMonth)} builder. ${monthName(topMonth)} is your month.`,
    detail: `Average per month across every year.${quiet}`,
  };
}
