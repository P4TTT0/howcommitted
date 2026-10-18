import type { History } from "@/domain/history";
import { type YearStats, yearCompare } from "@/domain/year-compare";
import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { quantizeUp } from "@/playback/schedule";

export const BPM = 120;
/** One sixteenth note at the tempo. */
export const GRID_SECONDS = 60 / BPM / 4;
const LEAD_SECONDS = 0.4;
/** Seconds a panel takes to count up and raise its week shape. */
export const PANEL_SECONDS = 1;
const NOW_DELAY_SECONDS = 1.2;
const SUMMARY_DELAY_SECONDS = 1.4;
/** Seconds the summary line takes to appear. */
export const SUMMARY_SECONDS = 0.3;
const TAIL_SECONDS = 1.6;

export const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export type PanelModel = {
  year: number;
  tag: string;
  background: string;
  foreground: string;
  total: number;
  activeDays: number;
  longestStreak: number;
  /** 0..1 per weekday, Monday first, of the busiest weekday of the year. */
  week: number[];
  /** Spoken in full, since the panel is drawn with numbers and bars. */
  reading: string;
};

export type Comparison = {
  earlier: PanelModel;
  now: PanelModel;
  summary: string;
};

export type ThenNowPlan = {
  /** Past years that can be "then", oldest first. */
  years: number[];
  nowYear: number;
  defaultThen: number;
  compare(thenYear: number): Comparison;
  /** Seconds at which the panels and the summary start. */
  thenTime: number;
  nowTime: number;
  summaryTime: number;
  duration: number;
};

/** Spread of a year's contributions: how many land on each active day. */
function perActiveDay(stats: YearStats): number {
  return stats.activeDays === 0 ? 0 : stats.total / stats.activeDays;
}

/** Neutral copy that compares two years; it never ranks them. */
export function summaryLine(then: YearStats, now: YearStats): string {
  const before = perActiveDay(then);
  const after = perActiveDay(now);
  const spread =
    after < before
      ? "spread across more days"
      : after > before
        ? "packed into fewer days"
        : "spread the same way";
  const weekend =
    now.weekendShare > then.weekendShare
      ? "More of it on weekends now"
      : now.weekendShare < then.weekendShare
        ? "Less of it on weekends now"
        : "Weekends held steady";
  return `Since ${then.year}: ${spread}. ${weekend}.`;
}

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

function panel(stats: YearStats, tag: string, firstYear: number): PanelModel {
  const colors = blockForYearIndex(stats.year - firstYear);
  const peak = Math.max(...stats.weekShape.weekdays);
  const week = stats.weekShape.weekdays.map((n) => (peak > 0 ? n / peak : 0));
  const days = stats.weekShape.weekdays
    .map((n, i) => `${WEEKDAY_LABELS[i]} ${formatCount(n)}`)
    .join(", ");
  return {
    year: stats.year,
    tag,
    background: colors.background,
    foreground: colors.foreground,
    total: stats.total,
    activeDays: stats.activeDays,
    longestStreak: stats.longestStreak,
    week,
    reading: `${tag} ${stats.year}: ${plural(stats.total, "contribution", "contributions")}, ${plural(stats.activeDays, "active day", "active days")}, longest streak ${plural(stats.longestStreak, "day", "days")}. By weekday: ${days}.`,
  };
}

/**
 * The comparison for the history, or null with fewer than two full years.
 * "Now" is the last full year (the year in progress is left out); "then" can
 * be any earlier year and starts at the busiest one by calendar contributions.
 * Counts are contributions of all types, never commits.
 */
export function planThenNow(
  history: History,
  today: Date = new Date(),
): ThenNowPlan | null {
  const full = history.years.filter(
    (entry) => entry.year < today.getUTCFullYear(),
  );
  if (full.length < 2) return null;
  const nowEntry = full[full.length - 1];
  const past = full.slice(0, -1);
  if (!nowEntry || past.length === 0) return null;

  const firstYear = history.years[0]?.year ?? nowEntry.year;
  const days = history.years.flatMap((entry) => entry.dailyContributions);
  const busiest = past.reduce((best, entry) =>
    entry.totalContributions > best.totalContributions ? entry : best,
  );

  const compare = (thenYear: number): Comparison => {
    const { a, b } = yearCompare(days, thenYear, nowEntry.year);
    return {
      earlier: panel(a, "Then", firstYear),
      now: panel(b, "Now · last full year", firstYear),
      summary: summaryLine(a, b),
    };
  };

  const thenTime = quantizeUp(LEAD_SECONDS, GRID_SECONDS);
  const nowTime = quantizeUp(thenTime + NOW_DELAY_SECONDS, GRID_SECONDS);
  const summaryTime = quantizeUp(nowTime + SUMMARY_DELAY_SECONDS, GRID_SECONDS);
  return {
    years: past.map((entry) => entry.year),
    nowYear: nowEntry.year,
    defaultThen: busiest.year,
    compare,
    thenTime,
    nowTime,
    summaryTime,
    duration: summaryTime + SUMMARY_SECONDS + TAIL_SECONDS,
  };
}

/** 0..1 of an ease-out-quart animation that starts at `start`. */
export function progressAt(
  start: number,
  length: number,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (seconds < start) return 0;
  if (reducedMotion) return 1;
  const linear = Math.min(1, (seconds - start) / length);
  return 1 - (1 - linear) ** 4;
}
