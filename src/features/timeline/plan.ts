import {
  aggregateWeekly,
  cumulativeByDay,
  type DailyCommits,
  weekSpan,
  yearSpans,
} from "@/playback/aggregate";
import {
  buildTickSlots,
  findMilestones,
  type Milestone,
  quantizeUp,
  type TickSlot,
} from "@/playback/schedule";
import { blocks, neutrals } from "@/ui/tokens";

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

export type Plan = {
  days: DailyCommits[];
  cumulative: number[];
  total: number;
  years: ReturnType<typeof yearSpans>;
  slots: TickSlot[];
  milestones: Milestone[];
  /** Cumulative total sampled at the end of each week, for the line. */
  linePoints: { progress: number; total: number }[];
};

export function blockForYearIndex(index: number) {
  return BLOCK_SEQUENCE[index % BLOCK_SEQUENCE.length] ?? BLOCK_SEQUENCE[0];
}

/** Everything the scene needs, derived once from the daily history. */
export function buildPlan(days: DailyCommits[]): Plan {
  const cumulative = cumulativeByDay(days);
  const milestones = findMilestones(days, {
    duration: DRAW_SECONDS,
    grid: GRID_SECONDS,
    step: MILESTONE_STEP,
    first: MILESTONE_FIRST,
    minGapToFinal: 1.5,
  });
  const slots = buildTickSlots(aggregateWeekly(days), weekSpan(days), {
    duration: DRAW_SECONDS,
    grid: GRID_SECONDS,
    runGapWeeks: RUN_GAP_WEEKS,
    resetTimes: milestones.map((milestone) => milestone.time),
  });

  const linePoints = [{ progress: 0, total: 0 }];
  for (let day = 7; day <= days.length; day += 7) {
    linePoints.push({
      progress: day / days.length,
      total: cumulative[day - 1] ?? 0,
    });
  }
  const last = cumulative[cumulative.length - 1] ?? 0;
  if (days.length % 7 !== 0) linePoints.push({ progress: 1, total: last });

  return {
    days,
    cumulative,
    total: last,
    years: yearSpans(days),
    slots,
    milestones,
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
