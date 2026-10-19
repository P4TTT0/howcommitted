import { activeDays } from "@/domain/activity";
import type { History } from "@/domain/history";
import { type Records, records } from "@/domain/records";
import { formatCount } from "@/features/sequencer/model/format";
import { quantizeUp } from "@/playback/schedule";

export const BPM = 120;
export const GRID_SECONDS = 60 / BPM / 4;
/** The streak strip never draws more ticks than this; longer streaks bucket days. */
export const MAX_TICKS = 120;
const STRIP_START = 0.5;
export const STRIP_SECONDS = 1.5;
const TILES_START = 2.25;
const TILE_STEP = 0.35;
export const POP_SECONDS = 0.3;
const TAIL_SECONDS = 1.75;

export type TileTone = "signal" | "plain" | "ink" | "safety";

export type RecordTile = {
  key: string;
  label: string;
  value: string;
  /** Unit shown after the value in smaller uppercase, e.g. "days"; none for dates. */
  unit?: string;
  /** The full reading, for screen readers only. */
  note: string;
  /** The short visible line under the value; empty when the value says it all. */
  caption: string;
  tone: TileTone;
  /** Seconds at which the tile starts to pop in (on the grid). */
  start: number;
};

export type RecordsPlan = {
  streakDays: number;
  streakRange: string;
  /** Opacity of each tick, 0.45..1, from the contributions on its days. */
  ticks: number[];
  /** Seconds at which the strip starts to fill. */
  stripStart: number;
  yearsNote: string;
  tiles: RecordTile[];
  duration: number;
};

const dateFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
const FULL = dateFormat({
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const MONTH_DAY = dateFormat({ month: "short", day: "numeric" });
const MONTH_DAY_YEAR = dateFormat({
  month: "short",
  day: "numeric",
  year: "numeric",
});
const MONTH_YEAR = dateFormat({ month: "long", year: "numeric" });
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Mar 3 — Jun 22, 2024", with the year on both ends when they differ. */
export function formatRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const first = (sameYear ? MONTH_DAY : MONTH_DAY_YEAR).format(utc(start));
  return `${first} — ${MONTH_DAY_YEAR.format(utc(end))}`;
}

/** "Mar 11 — 17, 2024" inside one month, otherwise a full range. */
export function formatWeek(start: string, end: string): string {
  if (start.slice(0, 7) !== end.slice(0, 7)) return formatRange(start, end);
  return `${MONTH_DAY.format(utc(start))} — ${Number(end.slice(8))}, ${end.slice(0, 4)}`;
}

/** "Mar 14" from an MM-DD, in a leap year so Feb 29 exists. */
export function formatMonthDay(monthDay: string): string {
  return MONTH_DAY.format(utc(`2000-${monthDay}`));
}

const plural = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

const unitFor = (count: number, one: string, many: string) =>
  count === 1 ? one : many;

function tilesFor(found: Records, total: number): Omit<RecordTile, "start">[] {
  const tiles: Omit<RecordTile, "start">[] = [];
  const day = found.busiestDay;
  const week = found.busiestWeek;
  const month = found.busiestMonth;
  const year = found.busiestYear;
  const quiet = found.longestQuiet;
  const date = found.yourDate;
  const push = (tile: Omit<RecordTile, "start">) => tiles.push(tile);

  if (day) {
    push({
      key: "busiest-day",
      label: "Busiest day",
      value: formatCount(day.count),
      unit: unitFor(day.count, "contribution", "contributions"),
      note: FULL.format(utc(day.date)),
      caption: MONTH_DAY_YEAR.format(utc(day.date)),
      tone: "signal",
    });
  }
  push({
    key: "average",
    label: "Average per active day",
    value: found.averagePerActiveDay.toFixed(1),
    unit: "contributions",
    note: `${formatCount(total)} contributions over ${formatCount(found.activeDays)} days`,
    caption: "",
    tone: "plain",
  });
  push({
    key: "active-days",
    label: "Days with a contribution",
    value: formatCount(found.activeDays),
    unit: unitFor(found.activeDays, "day", "days"),
    note: found.firstDate
      ? `Since your first, on ${MONTH_DAY_YEAR.format(utc(found.firstDate))}`
      : "",
    caption: "",
    tone: "plain",
  });
  push({
    key: "quiet",
    label: "Longest quiet stretch",
    value: formatCount(quiet?.length ?? 0),
    unit: unitFor(quiet?.length ?? 0, "day", "days"),
    note: quiet
      ? `Then you came back on ${MONTH_DAY_YEAR.format(utc(quiet.comeback))}`
      : "No gap between two active days",
    caption: quiet ? MONTH_DAY_YEAR.format(utc(quiet.comeback)) : "",
    tone: "ink",
  });
  if (week) {
    push({
      key: "busiest-week",
      label: "Busiest week",
      value: formatCount(week.count),
      unit: unitFor(week.count, "contribution", "contributions"),
      note: formatWeek(week.start, week.end),
      caption: formatWeek(week.start, week.end),
      tone: "plain",
    });
  }
  if (month) {
    push({
      key: "busiest-month",
      label: "Busiest month",
      value: formatCount(month.count),
      unit: unitFor(month.count, "contribution", "contributions"),
      note: MONTH_YEAR.format(utc(`${month.month}-01`)),
      caption: MONTH_YEAR.format(utc(`${month.month}-01`)),
      tone: "plain",
    });
  }
  if (date) {
    push({
      key: "your-date",
      label: "Your date",
      value: formatMonthDay(date.monthDay),
      note: `A contribution on it in ${date.years} of ${date.totalYears} years`,
      caption: `${date.years} of ${date.totalYears} years`,
      tone: "safety",
    });
  }
  if (year) {
    push({
      key: "busiest-year",
      label: "Busiest year",
      value: formatCount(year.count),
      unit: unitFor(year.count, "contribution", "contributions"),
      note: String(year.year),
      caption: String(year.year),
      tone: "plain",
    });
  }
  return tiles;
}

/** One opacity per tick: the busiest bucket is solid, the quietest at 0.45. */
export function streakTicks(
  counts: readonly number[],
  maxTicks = MAX_TICKS,
): number[] {
  if (counts.length === 0) return [];
  const size = Math.ceil(counts.length / maxTicks);
  const buckets: number[] = [];
  for (let i = 0; i < counts.length; i += size) {
    buckets.push(Math.max(...counts.slice(i, i + size)));
  }
  const peak = Math.max(...buckets);
  return buckets.map((count) => 0.45 + 0.55 * (count / peak));
}

/** The records from every year's calendar; null without a streak to show. */
export function planRecords(history: History): RecordsPlan | null {
  const days = history.years.flatMap((year) => year.dailyContributions);
  const found = records(days);
  const { start, end, length } = found.longestStreak;
  if (!start || !end || length === 0) return null;

  const counts = new Map(activeDays(days).map((d) => [d.date, d.count]));
  const streakCounts: number[] = [];
  for (let i = 0; i < length; i++) {
    const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    streakCounts.push(counts.get(date) ?? 0);
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const tiles = tilesFor(found, total).map((tile, index) => ({
    ...tile,
    start: quantizeUp(TILES_START + index * TILE_STEP, GRID_SECONDS),
  }));
  const lastStart = tiles.at(-1)?.start ?? TILES_START;
  const first = found.firstDate?.slice(0, 4);
  const last = found.lastDate?.slice(0, 4);
  return {
    streakDays: length,
    streakRange: formatRange(start, end),
    ticks: streakTicks(streakCounts),
    stripStart: quantizeUp(STRIP_START, GRID_SECONDS),
    yearsNote: first === last ? (first ?? "") : `${first} — ${last}`,
    tiles,
    duration: lastStart + POP_SECONDS + TAIL_SECONDS,
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Share of the strip filled at `seconds`, 0..1, linear so the fill reads as a count. */
export function stripFillAt(
  plan: Pick<RecordsPlan, "stripStart">,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1;
  return clamp01((seconds - plan.stripStart) / STRIP_SECONDS);
}

/** A tile's pop, 0..1: an ease-out with no bounce. */
export function popAt(
  tile: Pick<RecordTile, "start">,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1;
  return 1 - (1 - clamp01((seconds - tile.start) / POP_SECONDS)) ** 3;
}

/** Spoken and visible reading of one tile. */
export function tileReading(tile: RecordTile): string {
  const value = tile.unit ? `${tile.value} ${tile.unit}` : tile.value;
  return `${tile.label}: ${value}. ${tile.note}`;
}

export function streakReading(plan: RecordsPlan): string {
  return `Longest streak: ${plural(plan.streakDays, "day", "days")}, ${plan.streakRange}`;
}

/**
 * Clock times of the pops for the streak strip: one per tick as it draws,
 * quantized up to the grid. Ticks sharing a grid slot make one pop.
 */
export function stripPopTimes(
  plan: Pick<RecordsPlan, "stripStart" | "ticks">,
): number[] {
  const count = plan.ticks.length;
  const times = plan.ticks.map((_, index) =>
    quantizeUp(
      plan.stripStart + (STRIP_SECONDS * (index + 0.5)) / count,
      GRID_SECONDS,
    ),
  );
  return [...new Set(times)];
}
