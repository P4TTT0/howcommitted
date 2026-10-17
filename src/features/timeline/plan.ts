import type { DailyCommits } from "@/domain/types";
import { aggregateWeekly, weekSpan, yearSpans } from "@/playback/aggregate";
import {
  buildTickSlots,
  findMilestones,
  type Milestone,
  quantizeUp,
  type TickSlot,
} from "@/playback/schedule";
import { blocks, neutrals } from "@/ui/tokens";
import { formatCount } from "./format";

/** Seconds the line takes to draw. */
export const DRAW_SECONDS = 24;
/** Silence after the final payoff before the clock ends. */
export const TAIL_SECONDS = 2.5;
export const TOTAL_SECONDS = DRAW_SECONDS + TAIL_SECONDS;
export const BPM = 140;
/** One sixteenth note at the tempo. */
export const GRID_SECONDS = 60 / BPM / 4;
/** A payoff every this many commits... */
export const MILESTONE_STEP = 1000;
/** ...except the first, which comes early so the payoff lands sooner. */
export const MILESTONE_FIRST = 500;
/** Step payoffs are capped so floods never crowd the drawing window. */
export const MAX_STEP_MILESTONES = 12;

/**
 * Payoff spacing for a history of `total` commits: every 1,000 (the first at
 * 500), widened through 2,000, 5,000, 10,000... for very large histories so
 * the number of floods stays bounded.
 */
export function milestoneSchedule(total: number): {
  step: number;
  first: number;
} {
  if (total / MILESTONE_STEP <= MAX_STEP_MILESTONES) {
    return { step: MILESTONE_STEP, first: MILESTONE_FIRST };
  }
  for (let magnitude = MILESTONE_STEP; ; magnitude *= 10) {
    for (const factor of [2, 5, 10]) {
      const step = magnitude * factor;
      if (total / step <= MAX_STEP_MILESTONES) return { step, first: step / 2 };
    }
  }
}

/** Quiet weeks in a row that end a run; holidays should not. */
export const RUN_GAP_WEEKS = 6;

/** Flood timing in seconds. The year change never overlaps this window. */
export const FLOOD = {
  rise: 0.12,
  step: { hold: 0.35, fall: 0.5 },
  final: { hold: 1.4, fall: 0.7 },
} as const;
/** Seconds the incoming year takes to wipe in. */
export const YEAR_WIPE_SECONDS = 0.3;

/** Seconds a flood covers the screen, from impact to fully receded. */
export function floodSpan(kind: Milestone["kind"]): number {
  return FLOOD.rise + FLOOD[kind].hold + FLOOD[kind].fall;
}

/** Block colors in rotation order with the text color that passes contrast. */
export const BLOCK_SEQUENCE = [
  { background: blocks.ultramarine, foreground: neutrals.paper },
  { background: blocks.safety, foreground: neutrals.ink },
  { background: blocks.forest, foreground: neutrals.paper },
  { background: blocks.signal, foreground: neutrals.ink },
  { background: blocks.violet, foreground: neutrals.paper },
  { background: blocks.pink, foreground: neutrals.ink },
] as const;

/** Most labels drawn on the chart; the note always covers the rest. */
export const MAX_STEP_LABELS = 3;

/**
 * Commits the yearly total counts but no day carries (GitHub truncated the
 * per-day detail). They are never spread across days: the line takes one
 * explicit step at the end of the year. A negative amount means the daily
 * detail exceeds the yearly total; it is never scaled down either.
 */
export type UnattributedStep = {
  year: number;
  /** Index into `days` of the last day of the year in range. */
  dayIndex: number;
  /** Signed: official total minus the real daily commits of that year. */
  amount: number;
  /** Progress (0..1) at the end of that day. */
  progress: number;
  /** Seconds on the clock, quantized to the grid. */
  time: number;
  /** Running total just before and just after the step. */
  from: number;
  to: number;
};

export type StepInput = { year: number; dayIndex: number; amount: number };

export type LinePoint = {
  progress: number;
  total: number;
  /** The line is broken here: "from" ends the segment before a step, "to" starts the next. */
  jump?: "from" | "to";
};

export type Plan = {
  /** Real daily commits only: never scaled, never padded with invented ones. */
  days: DailyCommits[];
  /** Running total per day, including unattributed steps. */
  cumulative: number[];
  /** Where the counter ends: the sum of the official yearly totals. */
  total: number;
  /** Highest running total, which sets the chart scale. */
  peak: number;
  years: ReturnType<typeof yearSpans>;
  slots: TickSlot[];
  milestones: Milestone[];
  steps: UnattributedStep[];
  /** Cumulative total sampled at the end of each week, for the line. */
  linePoints: LinePoint[];
};

export function blockForYearIndex(index: number) {
  return BLOCK_SEQUENCE[index % BLOCK_SEQUENCE.length] ?? BLOCK_SEQUENCE[0];
}

/** Running total after each day, plus the step amounts released on their days. */
function cumulativeWithSteps(
  days: readonly DailyCommits[],
  stepAmounts: ReadonlyMap<number, number>,
): number[] {
  let total = 0;
  return days.map((day, index) => {
    total += Math.max(0, day.commits) + (stepAmounts.get(index) ?? 0);
    return total;
  });
}

/** Seconds at which the soft unattributed cue plays: once per growing step. */
export function stepCueTimes(plan: Plan): number[] {
  // A payoff on the same beat takes over, as it does for ticks.
  const payoffTimes = new Set(plan.milestones.map((m) => m.time));
  return plan.steps
    .filter((step) => step.amount > 0 && !payoffTimes.has(step.time))
    .map((step) => step.time);
}

/** The steps worth a label on the chart: the largest few, in time order. */
export function labelledSteps(steps: readonly UnattributedStep[]) {
  const biggest = [...steps]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, MAX_STEP_LABELS);
  return steps.filter((step) => biggest.includes(step));
}

export function stepLabel(step: UnattributedStep): string {
  return step.amount > 0
    ? `+${formatCount(step.amount)} not attributed to a day`
    : `-${formatCount(-step.amount)} over the yearly total`;
}

/**
 * Everything the scene needs, derived once from the daily history.
 *
 * `steps` add commits the daily detail does not carry. Milestones follow the
 * running total, so a threshold crossed inside a step fires at the step.
 */
export function buildPlan(
  days: DailyCommits[],
  stepInputs: readonly StepInput[] = [],
): Plan {
  const inputs = stepInputs.filter(
    (input) =>
      input.amount !== 0 && input.dayIndex >= 0 && input.dayIndex < days.length,
  );
  const stepAmounts = new Map(
    inputs.map((input) => [input.dayIndex, input.amount]),
  );
  const cumulative = cumulativeWithSteps(days, stepAmounts);
  const total = cumulative[cumulative.length - 1] ?? 0;
  const peak = Math.max(0, ...cumulative);

  const steps: UnattributedStep[] = [...inputs]
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((input) => {
      const progress = (input.dayIndex + 1) / days.length;
      const to = cumulative[input.dayIndex] ?? 0;
      return {
        ...input,
        progress,
        time: quantizeUp(progress * DRAW_SECONDS, GRID_SECONDS),
        from: to - input.amount,
        to,
      };
    });

  const lastReal = days.findLastIndex((day) => day.commits > 0);
  const lastGrowingStep = Math.max(
    -1,
    ...steps.filter((step) => step.amount > 0).map((step) => step.dayIndex),
  );
  const schedule = milestoneSchedule(total);
  const milestones = findMilestones(days, {
    duration: DRAW_SECONDS,
    grid: GRID_SECONDS,
    step: schedule.step,
    first: schedule.first,
    minGapToFinal: 1.5,
    cumulative,
    lastActiveDay: Math.max(lastReal, lastGrowingStep),
  });
  const slots = buildTickSlots(aggregateWeekly(days), weekSpan(days), {
    duration: DRAW_SECONDS,
    grid: GRID_SECONDS,
    runGapWeeks: RUN_GAP_WEEKS,
    resetTimes: milestones.map((milestone) => milestone.time),
  });

  const stepByDay = new Map(steps.map((step) => [step.dayIndex, step]));
  const linePoints: LinePoint[] = [{ progress: 0, total: 0 }];
  days.forEach((_, index) => {
    const step = stepByDay.get(index);
    if (step) {
      linePoints.push(
        { progress: step.progress, total: step.from, jump: "from" },
        { progress: step.progress, total: step.to, jump: "to" },
      );
    } else if ((index + 1) % 7 === 0) {
      linePoints.push({
        progress: (index + 1) / days.length,
        total: cumulative[index] ?? 0,
      });
    }
  });
  if ((linePoints.at(-1)?.progress ?? 0) < 1 && days.length > 0) {
    linePoints.push({ progress: 1, total });
  }

  return {
    days,
    cumulative,
    total,
    peak,
    years: yearSpans(days),
    slots,
    milestones,
    steps,
    linePoints,
  };
}

export type YearReveal = { year: number; index: number; time: number };

/**
 * When each year's block wipes in. Normally at the year boundary, on the
 * tempo grid; if a flood would cover that moment it waits until the flood
 * has receded, so the change is always seen.
 */
export function yearReveals(plan: Plan): YearReveal[] {
  return plan.years.map((span, index) => {
    let time = quantizeUp(span.startProgress * DRAW_SECONDS, GRID_SECONDS);
    if (index === 0) return { year: span.year, index, time: 0 };
    for (const milestone of plan.milestones) {
      const end = milestone.time + floodSpan(milestone.kind);
      if (time > milestone.time - YEAR_WIPE_SECONDS && time < end) {
        time = quantizeUp(end, GRID_SECONDS);
      }
    }
    return { year: span.year, index, time };
  });
}

/** Index of the year block on screen at `time` (for flood color). */
export function displayedYearIndex(
  reveals: readonly YearReveal[],
  time: number,
): number {
  let shown = 0;
  for (const reveal of reveals) {
    if (reveal.time <= time) shown = reveal.index;
  }
  return shown;
}
