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

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Shown in the readout until a weekday is picked. */
export const READOUT_IDLE = {
  day: "Pick a day",
  detail: "Hover or tap a weekday",
} as const;

/** Gridlines of the chart: the baseline plus this many steps above it. */
export const AXIS_STEPS = 3;
const AXIS_STEP_UNIT = 0.05;

export type PanelModel = {
  year: number;
  tag: string;
  background: string;
  foreground: string;
  total: number;
  activeDays: number;
  longestStreak: number;
  /** Contributions per weekday, Monday first. */
  counts: number[];
  /** 0..1 per weekday, Monday first: the share of the year's total. */
  week: number[];
  /** Spoken in full, since the panel is drawn with numbers and blocks. */
  reading: string;
};

export type Comparison = {
  earlier: PanelModel;
  now: PanelModel;
  summary: string;
  /** Top of the share axis, a multiple of AXIS_STEPS * 5%. */
  axisMax: number;
};

/** The weekday as read out: a name and both years' counts and shares. */
export type DayReading = { day: string; detail: string; label: string };

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
  const counts = stats.weekShape.weekdays;
  const sum = counts.reduce((total, n) => total + n, 0);
  const week = counts.map((n) => (sum > 0 ? n / sum : 0));
  return {
    year: stats.year,
    tag,
    background: colors.background,
    foreground: colors.foreground,
    total: stats.total,
    activeDays: stats.activeDays,
    longestStreak: stats.longestStreak,
    counts,
    week,
    reading: `${tag} ${stats.year}: ${plural(stats.total, "contribution", "contributions")}, ${plural(stats.activeDays, "active day", "active days")}, longest streak ${plural(stats.longestStreak, "day", "days")}.`,
  };
}

/** Top of the share axis: the smallest multiple of 15% that fits both years. */
export function axisMaxFor(...weeks: number[][]): number {
  const peak = Math.max(0, ...weeks.flat());
  const step = Math.max(
    AXIS_STEP_UNIT,
    Math.ceil(peak / AXIS_STEPS / AXIS_STEP_UNIT - 1e-9) * AXIS_STEP_UNIT,
  );
  return step * AXIS_STEPS;
}

/** Labels of the gridlines, baseline first: "0%", "10%", ... */
export function tickLabels(axisMax: number): string[] {
  return Array.from(
    { length: AXIS_STEPS + 1 },
    (_, i) => `${Math.round((axisMax * 100 * i) / AXIS_STEPS)}%`,
  );
}

/** Height of a bar as a percentage of the plot. */
export function barHeight(share: number, axisMax: number): number {
  return Math.min(100, Math.round((share / axisMax) * 100));
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** One weekday for both years, as text for the readout and the group label. */
/**
 * 0..1 hover level of a weekday: the taller of its two bars against the axis,
 * so the pitch follows what the eye sees.
 */
export function dayLevel(comparison: Comparison, index: number): number {
  const height = Math.max(
    barHeight(comparison.earlier.week[index] ?? 0, comparison.axisMax),
    barHeight(comparison.now.week[index] ?? 0, comparison.axisMax),
  );
  return Math.min(1, Math.max(0, height / 100));
}

export function dayReading(comparison: Comparison, index: number): DayReading {
  const { earlier, now } = comparison;
  const part = (model: PanelModel) =>
    `${model.year}: ${formatCount(model.counts[index] ?? 0)} (${percent(model.week[index] ?? 0)})`;
  const day = WEEKDAY_NAMES[index] ?? "";
  const detail = `${part(earlier)} · ${part(now)}`;
  return { day, detail, label: `${day}. ${detail}` };
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
    const earlier = panel(a, "Then", firstYear);
    const now = panel(b, "Now · last full year", firstYear);
    return {
      earlier,
      now,
      summary: summaryLine(a, b),
      axisMax: axisMaxFor(earlier.week, now.week),
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
