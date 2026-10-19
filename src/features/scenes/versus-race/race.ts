import { type Crossing, findCrossings } from "@/domain/crossings";
import { BPM, DRAW_SECONDS, type Plan } from "@/features/sequencer/model/plan";
import { dayNumber } from "@/playback/aggregate";

/**
 * The race model: every developer's running total on ONE shared daily axis by
 * calendar date. Lanes keep the order the developers were added in; the view
 * ranks the bars by the running total at each moment (`laneOrder`) and never
 * numbers them. The scale follows whoever is ahead at that moment
 * (`scaleFor`). Pure, so the layout and the sound grid can be tested.
 */

export { BPM, DRAW_SECONDS };

const MS_PER_DAY = 86_400_000;

export type RaceEntry = { login: string; plan: Plan };

export type RaceLane = {
  login: string;
  /** Running total per shared day. 0 before the first day, held after the last. */
  series: number[];
  total: number;
  /** Index of the first contribution on the axis; null without any. */
  firstIndex: number | null;
};

export type Race = {
  /** Day number (days since the epoch) of the first shared day. */
  startDay: number;
  /** Number of shared days. */
  length: number;
  /** In the order the developers were added. */
  lanes: RaceLane[];
  /** The calendar years the data covers. */
  firstYear: number;
  lastYear: number;
  /** Every time one line moved past another, oldest first. */
  crossings: Crossing[];
};

function laneSeries(
  plan: Plan,
  startDay: number,
  length: number,
): { series: number[]; total: number } {
  const series: number[] = [];
  let pointer = 0;
  let running = 0;
  for (let offset = 0; offset < length; offset++) {
    const day = startDay + offset;
    while (pointer < plan.days.length) {
      const date = plan.days[pointer]?.date;
      if (date === undefined || dayNumber(date) > day) break;
      running = plan.cumulative[pointer] ?? running;
      pointer++;
    }
    series.push(running);
  }
  return { series, total: series.at(-1) ?? 0 };
}

/** Day number of the first day with a contribution; null when none. */
function firstActiveDay(plan: Plan): number | null {
  const first = plan.days.find((day) => day.commits > 0);
  return first ? dayNumber(first.date) : null;
}

/** ISO date of a shared day. */
export function dateAtIndex(
  race: Pick<Race, "startDay">,
  index: number,
): string {
  return new Date((race.startDay + index) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function yearAtIndex(
  race: Pick<Race, "startDay">,
  index: number,
): number {
  return Number(dateAtIndex(race, index).slice(0, 4));
}

/**
 * The race, or null when nobody has a single day or nobody contributed at
 * all.
 */
export function buildRace(entries: readonly RaceEntry[]): Race | null {
  const firsts: number[] = [];
  const lasts: number[] = [];
  for (const { plan } of entries) {
    const first = plan.days[0];
    const last = plan.days.at(-1);
    if (!first || !last) continue;
    firsts.push(dayNumber(first.date));
    lasts.push(dayNumber(last.date));
  }
  if (firsts.length === 0) return null;
  const startDay = Math.min(...firsts);
  const length = Math.max(...lasts) - startDay + 1;
  const lanes: RaceLane[] = entries.map(({ login, plan }) => {
    const first = firstActiveDay(plan);
    return {
      login,
      ...laneSeries(plan, startDay, length),
      firstIndex: first === null ? null : first - startDay,
    };
  });
  if (Math.max(...lanes.map((lane) => lane.total)) <= 0) return null;

  return {
    startDay,
    length,
    lanes,
    firstYear: new Date(startDay * MS_PER_DAY).getUTCFullYear(),
    lastYear: new Date((startDay + length - 1) * MS_PER_DAY).getUTCFullYear(),
    crossings: findCrossings(lanes.map((lane) => lane.series)),
  };
}

/** The shared day under a progress through the race (0..1). */
export function indexAtProgress(race: Race, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.min(race.length - 1, Math.floor(clamped * race.length));
}

/** Every lane's running total on a shared day, in lane order. */
export function valuesAtIndex(race: Race, index: number): number[] {
  return race.lanes.map((lane) => lane.series[index] ?? 0);
}

/**
 * Lane positions from the top bar to the bottom one: the largest running
 * total first, ties in the order the developers were added. Only a visual
 * order of the bars; nothing is ranked or numbered.
 */
export function laneOrder(values: readonly number[]): number[] {
  return values
    .map((value, lane) => ({ value, lane }))
    .sort((a, b) => b.value - a.value || a.lane - b.lane)
    .map(({ lane }) => lane);
}

/** First day of each calendar year on the axis, with where it falls (0..1). */
export function yearMarks(
  race: Race,
): { label: string; startProgress: number }[] {
  const marks: { label: string; startProgress: number }[] = [];
  let previous: number | null = null;
  for (let index = 0; index < race.length; index++) {
    const year = yearAtIndex(race, index);
    if (previous !== year) {
      marks.push({ label: String(year), startProgress: index / race.length });
      previous = year;
    }
  }
  return marks;
}

/** Index of the first day of `year` on the axis (0 for the first year). */
export function yearStartIndex(race: Race, year: number): number {
  const day = Date.UTC(year, 0, 1) / MS_PER_DAY - race.startDay;
  return Math.min(race.length - 1, Math.max(0, day));
}

/** The leader sits at about this share of the plot width. */
export const LEADER_SHARE = 0.64;
/** The scale never gets smaller than this, so an empty race has no 0/0. */
const MIN_SCALE = 20;
/** The most gridlines `niceTicks` ever returns (0 included). */
export const MAX_TICKS = 5;

/**
 * Contributions that fill the whole plot width. It follows the current
 * leader, so it grows smoothly as the totals grow, and the leader stays near
 * `LEADER_SHARE` of the width.
 */
export function scaleFor(values: readonly number[]): number {
  return Math.max(MIN_SCALE, Math.max(0, ...values) / LEADER_SHARE);
}

/** Gridlines stop short of the right edge so their labels stay inside it. */
const TICK_REACH = 0.94;

export type Tick = { value: number; x: number; label: string };

/** Gridlines at round numbers (0, 1k, 2.5k...) that fit inside `scale`. */
export function niceTicks(scale: number): Tick[] {
  const raw = scale / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ??
    10 * magnitude;
  const ticks: Tick[] = [];
  for (let k = 0; k * step <= scale * TICK_REACH; k++) {
    const value = Math.round(k * step * 1000) / 1000;
    ticks.push({ value, x: value / scale, label: tickLabel(value) });
  }
  return ticks;
}

/** 0, 500, 2.5k, 12k, 1.5M: compact, because a gridline label has little room. */
export function tickLabel(value: number): string {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${+(value / 1000).toFixed(2)}k`;
  return String(value);
}

/**
 * The pass to announce at a moment: the latest crossing at or before `index`
 * that happened within the last `windowDays` days; null when none did.
 */
export function activePass(
  race: Race,
  index: number,
  windowDays: number,
): Crossing | null {
  let found: Crossing | null = null;
  for (const crossing of race.crossings) {
    if (crossing.index > index) break;
    if (crossing.index > index - windowDays) found = crossing;
  }
  return found;
}

/**
 * How long a pass stays announced while playing: about a second and a half of
 * clock time, whatever the length of the history.
 */
export function playbackPassDays(race: Race): number {
  return Math.max(21, Math.round((race.length * 1.6) / DRAW_SECONDS));
}

/** "0 passes", "1 pass", "12 passes". */
export function passesLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "pass" : "passes"}`;
}

/** Shortest fill worth playing, in seconds. */
const MIN_FILL_SECONDS = 0.2;
/** Passes closer than this share one payoff: the chip is replaced anyway. */
export const MIN_PAYOFF_GAP_SECONDS = 1.5;

/**
 * One segment per calendar year of one continuous climb tied to the leader's
 * total: it starts where the year starts, lasts as long as the year takes on
 * the clock, and `from`/`to` (0..1) are the leader's share of its final total
 * at the year's start and end. Years where nobody gained are skipped (the bars
 * do not move).
 */
export function fillSegments(
  race: Race,
): { start: number; duration: number; from: number; to: number }[] {
  const marks = yearMarks(race);
  const leader = (index: number) =>
    Math.max(0, ...race.lanes.map((lane) => lane.series[index] ?? 0));
  const finalLeader = leader(race.length - 1);
  const segments: {
    start: number;
    duration: number;
    from: number;
    to: number;
  }[] = [];
  marks.forEach((mark, position) => {
    const end = marks[position + 1]?.startProgress ?? 1;
    const first = Math.round(mark.startProgress * race.length);
    const last = Math.min(race.length - 1, Math.round(end * race.length) - 1);
    const before = first > 0 ? leader(first - 1) : 0;
    if (leader(last) <= before) return;
    const duration = (end - mark.startProgress) * DRAW_SECONDS;
    if (duration < MIN_FILL_SECONDS) return;
    segments.push({
      start: mark.startProgress * DRAW_SECONDS,
      duration,
      from: finalLeader > 0 ? before / finalLeader : 0,
      to: finalLeader > 0 ? leader(last) / finalLeader : 1,
    });
  });
  return segments;
}

/**
 * Clock seconds at which a "@a passes @b" chip appears while playing: the
 * moment the playing day reaches each crossing, thinned so two passes within
 * `minGap` seconds make one payoff (the later chip replaces the earlier).
 */
export function passTimes(
  race: Race,
  minGap = MIN_PAYOFF_GAP_SECONDS,
): number[] {
  const times: number[] = [];
  for (const crossing of race.crossings) {
    const time = (crossing.index / race.length) * DRAW_SECONDS;
    const previous = times.at(-1);
    if (previous === undefined || time - previous >= minGap) times.push(time);
  }
  return times;
}

/** What assistive tech reads for a day: the moment and every lane, in lane order. */
export function dayReading(race: Race, index: number): string {
  const values = valuesAtIndex(race, index);
  const parts = race.lanes.map(
    (lane, laneIndex) =>
      `@${lane.login} ${(values[laneIndex] ?? 0).toLocaleString("en-US")}`,
  );
  return `${dateAtIndex(race, index)}: ${parts.join(", ")} contributions so far`;
}
