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
    runGapWeeks: 3,
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
