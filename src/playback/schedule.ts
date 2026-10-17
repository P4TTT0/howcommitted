import {
  cumulativeByDay,
  type DailyCommits,
  type WeeklyCommits,
} from "./aggregate";
import { degreeInRegister, restartRegister } from "./pitch";

/** One audible hit: every week that lands on the same grid cell merged. */
export type TickSlot = {
  /** Seconds on the clock, always a multiple of the grid. */
  time: number;
  /** Commits folded into this slot. */
  count: number;
  /** Running total once the slot has played. */
  total: number;
  /** Streak index; resets after quiet gaps and after each milestone. */
  run: number;
  /** Commits accumulated inside the run, including this slot. */
  runAccumulated: number;
  /** Pentatonic scale degree to play (see pitch.ts). */
  degree: number;
  /** 0..1 loudness hint relative to the busiest slot. */
  intensity: number;
};

export type Milestone = {
  time: number;
  /** The total this milestone celebrates. */
  value: number;
  kind: "step" | "final";
};

export type SlotOptions = {
  /** Seconds the whole range is mapped onto. */
  duration: number;
  /** Grid cell in seconds (for example a 16th note). */
  grid: number;
  /** Empty weeks in a row that end a run. */
  runGapWeeks: number;
  /** Times at which a payoff plays; each one also starts a new run. */
  resetTimes?: readonly number[];
};

const EPSILON = 1e-9;

/** Rounds a time up to the next grid line (never earlier than `time`). */
export function quantizeUp(time: number, grid: number): number {
  return Math.ceil(time / grid - EPSILON) * grid + 0; // + 0 turns -0 into 0
}

/**
 * Turns weekly commits into audible slots on the tempo grid. A week sounds
 * when the drawn line has finished it; several weeks sharing a grid cell
 * become a single hit, which bounds the hit rate by the tempo.
 */
export function buildTickSlots(
  weeks: readonly WeeklyCommits[],
  spanWeeks: number,
  { duration, grid, runGapWeeks, resetTimes = [] }: SlotOptions,
): TickSlot[] {
  if (spanWeeks <= 0) return [];
  const cells = new Map<number, { count: number; lastWeek: number }>();
  for (const { week, count } of weeks) {
    const end = ((week + 1) / spanWeeks) * duration;
    const cell = Math.round(quantizeUp(end, grid) / grid);
    const entry = cells.get(cell);
    cells.set(cell, { count: (entry?.count ?? 0) + count, lastWeek: week });
  }

  const ordered = [...cells.entries()].sort(([a], [b]) => a - b);
  const maxCount = Math.max(1, ...ordered.map(([, cell]) => cell.count));
  const slots: TickSlot[] = [];
  let run = 0;
  let total = 0;
  let runAccumulated = 0;
  let register = 0;
  let degree = 0;
  let previousWeek = Number.NEGATIVE_INFINITY;
  let previousTime = Number.NEGATIVE_INFINITY;

  for (const [cell, { count, lastWeek }] of ordered) {
    const time = cell * grid;
    const quietWeeks = lastWeek - previousWeek - 1;
    const crossedReset = resetTimes.some(
      (reset) => reset > previousTime + EPSILON && reset < time - EPSILON,
    );
    if (slots.length > 0 && (quietWeeks >= runGapWeeks || crossedReset)) {
      run += 1;
      runAccumulated = 0;
      // Restart from the current register rather than the root.
      register = restartRegister(degree, run);
    }
    total += count;
    runAccumulated += count;
    degree = degreeInRegister(runAccumulated, register);
    slots.push({
      time,
      count,
      total,
      run,
      runAccumulated,
      degree,
      intensity: Math.sqrt(count / maxCount),
    });
    previousWeek = lastWeek;
    previousTime = time;
  }
  return slots;
}

export type MilestoneOptions = {
  duration: number;
  grid: number;
  /** A payoff every `step` commits (for example 1,000). */
  step: number;
  /** Value of the first payoff, if it should come earlier than `step`. */
  first?: number;
  /** Step milestones this close to the final one (seconds) are dropped. */
  minGapToFinal: number;
};

/**
 * Finds the moments a payoff plays: each time the running total crosses
 * `first` and then each multiple of `step`, plus the final total. Times are quantized to the grid.
 */
export function findMilestones(
  days: readonly DailyCommits[],
  { duration, grid, step, first = step, minGapToFinal }: MilestoneOptions,
): Milestone[] {
  const cumulative = cumulativeByDay(days);
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (total <= 0) return [];
  const dayCount = days.length;
  // Time at which the line has finished day `index`.
  const timeAfterDay = (index: number) =>
    quantizeUp(((index + 1) / dayCount) * duration, grid);

  const finalTime = timeAfterDay(days.findLastIndex((day) => day.count > 0));
  const milestones: Milestone[] = [];

  let nextValue = first;
  for (let index = 0; index < dayCount && nextValue < total; index += 1) {
    const running = cumulative[index] ?? 0;
    if (running < nextValue) continue;
    const time = timeAfterDay(index);
    if (finalTime - time >= minGapToFinal) {
      milestones.push({ time, value: nextValue, kind: "step" });
    }
    // One day can cross several thresholds; skip the ones it covered.
    nextValue = (Math.floor(running / step) + 1) * step;
  }

  milestones.push({ time: finalTime, value: total, kind: "final" });
  return milestones;
}
