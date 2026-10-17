import { type YearBlock, yearBlocksInRange } from "@/domain/year-summary";
import { quantizeUp } from "@/playback/schedule";

export const BPM = 140;
/** One sixteenth note at the tempo. */
export const GRID_SECONDS = 60 / BPM / 4;
/** Silence before the first block rises. */
const LEAD_SECONDS = 0.4;
/** Seconds one block takes to rise. */
export const RISE_SECONDS = 0.4;
/** Hold after the last block before the scene ends. */
const TAIL_SECONDS = 1.4;
const MIN_SECONDS = 4;
/** Time between blocks: faster for long histories, always on the grid. */
const MIN_STEP_SECONDS = 0.2;
const MAX_STEP_SECONDS = 0.6;
const TARGET_REVEAL_SECONDS = 6;
/** Highest scale degree the climb reaches (see playback/pitch). */
const MAX_DEGREE = 10;

export type YearBar = {
  year: number;
  contributions: number;
  /** 0..1 of the tallest year. Height is the calendar total, nothing else. */
  ratio: number;
  /** Position in the rotating block palette, from the first year. */
  colorIndex: number;
  /** Seconds on the clock at which the block starts to rise (on the grid). */
  time: number;
  /** Scale degree of its tick: the climb across the years. */
  degree: number;
};

export type YearBarsPlan = {
  bars: YearBar[];
  duration: number;
};

/** One bar per calendar year between the first and last, quiet years as zeros. */
export function planYearBars(
  blocks: readonly YearBlock[],
  firstYear: number,
  lastYear: number,
): YearBarsPlan {
  const years = yearBlocksInRange(blocks, firstYear, lastYear);
  const peak = Math.max(1, ...years.map((block) => block.contributions));
  const desired = Math.min(
    MAX_STEP_SECONDS,
    Math.max(MIN_STEP_SECONDS, TARGET_REVEAL_SECONDS / years.length),
  );
  const step = Math.max(1, Math.round(desired / GRID_SECONDS)) * GRID_SECONDS;

  const bars = years.map((block, index) => ({
    year: block.year,
    contributions: block.contributions,
    ratio: Math.max(0, block.contributions) / peak,
    colorIndex: index,
    time: quantizeUp(LEAD_SECONDS + index * step, GRID_SECONDS),
    degree: Math.round((index * MAX_DEGREE) / Math.max(1, years.length - 1)),
  }));
  const lastTime = bars.at(-1)?.time ?? 0;
  return {
    bars,
    duration: Math.max(MIN_SECONDS, lastTime + RISE_SECONDS + TAIL_SECONDS),
  };
}

/** 0..1 rise of a bar at `seconds`: a decisive ease-out, no bounce. */
export function riseProgress(
  bar: Pick<YearBar, "time">,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (seconds < bar.time) return 0;
  if (reducedMotion) return 1;
  const linear = Math.min(1, (seconds - bar.time) / RISE_SECONDS);
  return 1 - (1 - linear) ** 4;
}

/** Index of the bar being shown at `seconds`; the first until one starts. */
export function activeBarIndex(
  bars: readonly Pick<YearBar, "time">[],
  seconds: number,
): number {
  let active = 0;
  bars.forEach((bar, index) => {
    if (bar.time <= seconds) active = index;
  });
  return active;
}
