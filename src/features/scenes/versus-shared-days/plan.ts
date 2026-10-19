import {
  activeDates,
  mondayFirstWeekday,
  type SharedDay,
  type SharedStats,
  sharedCount,
  sharedDays,
  sharedStats,
} from "@/domain/shared-days";
import type { VersusEntry } from "@/features/sequencer/types";
import { quantizeUp } from "@/playback/schedule";

/**
 * The shared days model: one calendar year at a time, every day split between
 * the developers who contributed, laid out two ways (a strip of weeks for wide
 * screens, a block per month for phones). Pure, so layout, copy and timing can
 * be tested. Calendar contributions of every type, never commits.
 */

/** Columns of the week strip: 53 weeks plus one for a year that starts late. */
export const WEEK_COLUMNS = 54;
export const WEEK_SLOTS = WEEK_COLUMNS * 7;
/** A month block is 7 columns (Mon..Sun) by 6 rows. */
export const MONTH_BLOCK = 42;
export const MONTH_SLOTS = 12 * MONTH_BLOCK;

/** Seconds the grid takes to appear, then the stats fade in. */
export const REVEAL_SECONDS = 6;
export const STATS_FADE_SECONDS = 0.6;
export const TOTAL_SECONDS = REVEAL_SECONDS + STATS_FADE_SECONDS + 2.5;
/** Said by the grid to assistive tech; the sentence is not shown on screen. */
export const GRID_DESCRIPTION =
  "Each square is a day. It splits into the color of every developer who contributed that day.";

export const BPM = 140;
export const GRID_SECONDS = 60 / BPM / 4;

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const WEEKDAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export type YearData = {
  year: number;
  days: SharedDay[];
  stats: SharedStats;
  /** Slot of the week strip (column-major, Monday first) to a day index, or null. */
  weekSlots: (number | null)[];
  /** Slot of the month blocks (12 blocks of 42) to a day index, or null. */
  monthSlots: (number | null)[];
  /** Week column where each month starts (for the labels over the strip). */
  monthColumns: number[];
  /** Days with at least two developers. */
  together: number;
};

export type SharedDaysModel = {
  logins: string[];
  years: number[];
  defaultYear: number;
  yearData(year: number): YearData;
};

function dayOfYear(date: string): number {
  const year = Number(date.slice(0, 4));
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.UTC(year, 0, 1)) / 86_400_000,
  );
}

/** Slots of the week strip: a day sits at `lead + dayOfYear`, Monday on top. */
export function weekSlots(year: number, dayCount: number): (number | null)[] {
  const lead = mondayFirstWeekday(`${year}-01-01`);
  const slots = new Array<number | null>(WEEK_SLOTS).fill(null);
  for (let day = 0; day < dayCount; day++) slots[lead + day] = day;
  return slots;
}

/** Slots of the month blocks: row = week of the month, column = weekday. */
export function monthSlots(year: number, dayCount: number): (number | null)[] {
  const slots = new Array<number | null>(MONTH_SLOTS).fill(null);
  for (let day = 0; day < dayCount; day++) {
    const date = new Date(Date.UTC(year, 0, 1) + day * 86_400_000);
    const month = date.getUTCMonth();
    const first = mondayFirstWeekday(
      `${year}-${String(month + 1).padStart(2, "0")}-01`,
    );
    slots[month * MONTH_BLOCK + first + date.getUTCDate() - 1] = day;
  }
  return slots;
}

/** Week column where each month of the year begins. */
export function monthColumns(year: number): number[] {
  const lead = mondayFirstWeekday(`${year}-01-01`);
  return MONTH_NAMES.map((_, month) =>
    Math.floor(
      (lead + dayOfYear(`${year}-${String(month + 1).padStart(2, "0")}-01`)) /
        7,
    ),
  );
}

/** "Sun, Mar 15" (the year is the stepper's) */
export function dateTitle(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAY_NAMES[parsed.getUTCDay()]}, ${MONTH_NAMES[parsed.getUTCMonth()]} ${parsed.getUTCDate()}`;
}

/** What a day reads as: who contributed, in the order they were added. */
export function dayDetail(day: SharedDay, logins: readonly string[]): string {
  if (day.people.length === 0) return "Nobody that day";
  return day.people.map((person) => `@${logins[person]}`).join(" · ");
}

const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five"] as const;

/** The label over the "everyone" number, for 2 to 5 developers. */
export function everyoneLabel(people: number): string {
  if (people === 2) return "Both showed up";
  return `All ${(COUNT_WORDS[people] ?? String(people)).toLowerCase()} showed up`;
}

/** Null when nobody contributed on any day. */
export function buildSharedDays(
  entries: readonly VersusEntry[],
): SharedDaysModel | null {
  const active = entries.map(({ model }) =>
    activeDates(
      model.plan.days.map(({ date, commits }) => ({ date, count: commits })),
    ),
  );
  const all = active.flatMap((dates) => [...dates]).sort();
  const first = all[0];
  const last = entries
    .flatMap(({ model }) => model.plan.days.at(-1)?.date ?? [])
    .sort()
    .at(-1);
  if (!first || !last) return null;

  const firstYear = Number(first.slice(0, 4));
  const lastYear = Number(last.slice(0, 4));
  const years: number[] = [];
  for (let year = firstYear; year <= lastYear; year++) years.push(year);

  const cache = new Map<number, YearData>();
  const yearData = (year: number): YearData => {
    const cached = cache.get(year);
    if (cached) return cached;
    const days = sharedDays(year, active, last);
    const data: YearData = {
      year,
      days,
      stats: sharedStats(days, entries.length),
      weekSlots: weekSlots(year, days.length),
      monthSlots: monthSlots(year, days.length),
      monthColumns: monthColumns(year),
      together: sharedCount(days),
    };
    cache.set(year, data);
    return data;
  };

  // The latest year in which at least two of them showed up on the same day.
  const defaultYear =
    [...years].reverse().find((year) => yearData(year).together > 0) ??
    lastYear;

  return {
    logins: entries.map((entry) => entry.login),
    years,
    defaultYear,
    yearData,
  };
}

/** Which of `groups` equal groups are revealed at a progress (0..1). */
export function groupsShown(progress: number, groups: number): number {
  return Math.min(groups, Math.max(0, Math.ceil(progress * groups - 1e-9)));
}

/**
 * Clock times of one pop per group (a week column or a month block) as the
 * grid draws, quantized up to the grid. Group `g` shows once the progress
 * passes `g / groups`, the same rule as `groupsShown`.
 */
export function groupPopTimes(groups: number): number[] {
  const times = Array.from({ length: groups }, (_, group) =>
    quantizeUp((group / groups) * REVEAL_SECONDS, GRID_SECONDS),
  );
  return [...new Set(times)];
}

/** Share of the developers present on a day, 0..1: the hover pitch. */
export function presenceLevel(day: Pick<SharedDay, "people">, people: number) {
  return people <= 0 ? 0 : Math.min(1, day.people.length / people);
}
