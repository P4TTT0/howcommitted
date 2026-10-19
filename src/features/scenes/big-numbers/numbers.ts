import type { History } from "@/domain/history";
import type { YearTotals } from "@/domain/types";
import { formatCount } from "@/features/sequencer/model/format";
import { quantizeUp } from "@/playback/schedule";
import { type MixPlan, planMix } from "./mix";

export const BPM = 120;
/** One sixteenth note at the tempo. */
export const GRID_SECONDS = 60 / BPM / 4;
/** Silence before the first number starts counting. */
const LEAD_SECONDS = 0.5;
/** Time between one number starting and the next; counts never overlap. */
const STEP_SECONDS = 1.5;
/** Seconds one number takes to count up. */
export const COUNT_SECONDS = 1.25;
/** Hold after the last number lands before the scene ends. */
const TAIL_SECONDS = 1.75;
const MIN_SECONDS = 4;

type TotalsKey = Exclude<keyof YearTotals, "privateContributions">;

const DEFINITIONS: readonly {
  key: TotalsKey;
  label: string;
  /** Scale degree of the cue when the number lands. */
  degree: number;
}[] = [
  { key: "commits", label: "Commits", degree: 2 },
  { key: "pullRequests", label: "Pull requests", degree: 4 },
  { key: "reviews", label: "Reviews", degree: 7 },
  { key: "issues", label: "Issues", degree: 10 },
];

export type YearValue = { year: number; value: number };

export type BigNumber = {
  key: TotalsKey;
  label: string;
  total: number;
  /** Oldest first. */
  perYear: YearValue[];
  /** Position in the block palette. */
  colorIndex: number;
  /** Seconds at which the count starts (on the grid). */
  start: number;
  /** Seconds at which it reaches its total (on the grid). */
  land: number;
  degree: number;
};

export type BigNumbersPlan = {
  numbers: BigNumber[];
  duration: number;
  /** Shared private contributions: a count only, not part of the four numbers. */
  privateContributions: number;
  /** First year vs latest year; null with a single active year. */
  mix: MixPlan | null;
};

/** The four totals from the history; null when there is nothing to show. */
export function planBigNumbers(history: History): BigNumbersPlan | null {
  if (DEFINITIONS.every(({ key }) => history.totals[key] <= 0)) return null;

  const numbers = DEFINITIONS.map((definition, index) => {
    const start = quantizeUp(LEAD_SECONDS + index * STEP_SECONDS, GRID_SECONDS);
    return {
      key: definition.key,
      label: definition.label,
      total: Math.max(0, history.totals[definition.key]),
      perYear: history.years.map((year) => ({
        year: year.year,
        value: year.totals[definition.key],
      })),
      colorIndex: index,
      start,
      land: quantizeUp(start + COUNT_SECONDS, GRID_SECONDS),
      degree: definition.degree,
    };
  });
  const lastLand = numbers.at(-1)?.land ?? 0;
  return {
    numbers,
    duration: Math.max(MIN_SECONDS, lastLand + TAIL_SECONDS),
    privateContributions: Math.max(0, history.totals.privateContributions),
    mix: planMix(history),
  };
}

/** The value shown at `seconds`: a decisive ease-out count, no bounce. */
export function countAt(
  number: Pick<BigNumber, "total" | "start" | "land">,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (seconds < number.start) return 0;
  if (reducedMotion || seconds >= number.land) return number.total;
  const linear = (seconds - number.start) / (number.land - number.start);
  return Math.round(number.total * (1 - (1 - linear) ** 4));
}

export type CountSound = {
  /** Seconds on the scene clock. */
  time: number;
  /** Displayed value as a share of the total, 0..1. */
  progress: number;
};

/** Most ticks one count makes: enough to read as a climb, few enough to stay clean. */
export const COUNT_TICKS = 12;

/** Ticks of a count: one per unit for small values, capped for big ones. 0 gets none. */
export function tickCount(total: number, cap: number = COUNT_TICKS): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(Math.floor(total), cap);
}

/**
 * The ticks of one count. Tick `i` lands when the screen reaches its share
 * `(i + 0.5) / ticks` of the total, so it follows the same ease-out as
 * `countAt`: a value of 2 ticks twice, as the display goes 1 then 2. With
 * reduced motion the number does not count: no ticks.
 */
export function countSounds(
  number: Pick<BigNumber, "start" | "land" | "total">,
  reducedMotion: boolean,
  cap: number = COUNT_TICKS,
): CountSound[] {
  const ticks = tickCount(number.total, cap);
  if (reducedMotion || ticks === 0) return [];
  const span = number.land - number.start;
  return Array.from({ length: ticks }, (_, index) => {
    const progress = (index + 0.5) / ticks;
    // Invert the ease-out (1 - (1 - t) ** 4) to find when that share shows.
    const linear = 1 - (1 - progress) ** 0.25;
    return { time: number.start + span * linear, progress };
  });
}

/** The honest line under the numbers. */
export function scopeNote(privateContributions: number): string {
  const base = "Public activity only, across all years.";
  return privateContributions > 0
    ? `${base} ${formatCount(privateContributions)} private contributions are shared but not counted here.`
    : base;
}

/** Spoken and visible reading of the whole number. */
export function totalReading(
  number: Pick<BigNumber, "label" | "total">,
): string {
  return `${number.label}: ${formatCount(number.total)} in total`;
}

/** The idle line over each tile's year chart. */
export const BY_YEAR = "By year";

/** Spoken and visible reading of one year of a number. */
export function yearReading(
  number: Pick<BigNumber, "label">,
  entry: YearValue,
): string {
  return `${entry.year}: ${formatCount(entry.value)} ${number.label.toLowerCase()}`;
}
