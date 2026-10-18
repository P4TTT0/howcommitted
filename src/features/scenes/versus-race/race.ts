import {
  BPM,
  DRAW_SECONDS,
  GRID_SECONDS,
  type Plan,
} from "@/features/sequencer/model/plan";
import { dayNumber } from "@/playback/aggregate";

/**
 * The race model: every developer's running total on ONE shared daily axis.
 * Lanes keep the order the developers were added in; nothing here ever sorts
 * or ranks. Pure, so the layout and the sound grid can be tested.
 */

export { BPM, DRAW_SECONDS };

const MS_PER_DAY = 86_400_000;

export type RaceEntry = { login: string; plan: Plan };

export type RaceLane = {
  login: string;
  /** Running total per shared day. 0 before the first day, held after the last. */
  series: number[];
  total: number;
};

export type Race = {
  /** Day number (days since the epoch) of the first shared day. */
  startDay: number;
  /** Number of shared days. */
  length: number;
  /** In the order the developers were added. */
  lanes: RaceLane[];
  /** Highest total of any lane: the one fixed scale of every bar. */
  peak: number;
  firstYear: number;
  lastYear: number;
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

/** Null when nobody has a single day or nobody contributed at all. */
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
  const lanes = entries.map(({ login, plan }) => ({
    login,
    ...laneSeries(plan, startDay, length),
  }));
  const peak = Math.max(...lanes.map((lane) => lane.total));
  if (peak <= 0) return null;
  return {
    startDay,
    length,
    lanes,
    peak,
    firstYear: yearAtIndex({ startDay }, 0),
    lastYear: yearAtIndex({ startDay }, length - 1),
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

/** First day of each calendar year on the axis, with where it falls (0..1). */
export function yearMarks(
  race: Race,
): { year: number; startProgress: number }[] {
  const marks: { year: number; startProgress: number }[] = [];
  for (let index = 0; index < race.length; index++) {
    const year = yearAtIndex(race, index);
    if (marks.at(-1)?.year !== year) {
      marks.push({ year, startProgress: index / race.length });
    }
  }
  return marks;
}

/** Seconds between ticks: a quarter note, so the sound stays aggregated. */
export const TICK_SECONDS = GRID_SECONDS * 4;

/**
 * Which lanes grew during each tick of the drawing window, in lane order. A
 * tick is one aggregated hit per growing developer, never one per contribution.
 */
export function growthSlots(race: Race): { time: number; lanes: number[] }[] {
  const count = Math.floor(DRAW_SECONDS / TICK_SECONDS);
  const slots: { time: number; lanes: number[] }[] = [];
  let previous = 0;
  for (let slot = 1; slot <= count; slot++) {
    const index = indexAtProgress(race, slot / count);
    const grown: number[] = [];
    race.lanes.forEach((lane, laneIndex) => {
      const before = previous > 0 ? (lane.series[previous - 1] ?? 0) : 0;
      if ((lane.series[index] ?? 0) > before) grown.push(laneIndex);
    });
    previous = index + 1;
    slots.push({ time: (slot - 1) * TICK_SECONDS, lanes: grown });
  }
  return slots;
}

/** What assistive tech reads for a day: the date and every lane, in lane order. */
export function dayReading(race: Race, index: number): string {
  const values = valuesAtIndex(race, index);
  const parts = race.lanes.map(
    (lane, laneIndex) =>
      `@${lane.login} ${(values[laneIndex] ?? 0).toLocaleString("en-US")}`,
  );
  return `${dateAtIndex(race, index)}: ${parts.join(", ")} contributions so far`;
}
