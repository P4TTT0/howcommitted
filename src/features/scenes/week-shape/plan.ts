import type { History } from "@/domain/history";
import { type RhythmLabel, rhythm } from "@/domain/rhythm";
import { weekShape } from "@/domain/week-shape";
import { formatCount } from "@/features/sequencer/model/format";
import { quantizeUp } from "@/playback/schedule";

export const BPM = 120;
export const GRID_SECONDS = 60 / BPM / 4;
const LEAD_SECONDS = 0.5;
/** Time between one bar starting and the next. */
const STEP_SECONDS = 0.4;
/** Seconds one bar takes to grow. */
export const GROW_SECONDS = 0.6;
/** Seconds the rhythm bar takes to settle once the bars are in. */
export const RHYTHM_SECONDS = 0.8;
const TAIL_SECONDS = 1.5;

const NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type WeekBar = {
  index: number;
  name: string;
  short: string;
  value: number;
  /** Share of all contributions, whole percent. */
  percent: number;
  /** Height relative to the tallest bar, 0..1. */
  ratio: number;
  weekend: boolean;
  /** Seconds at which the bar starts to grow (on the grid). */
  start: number;
  /** Seconds at which it is full height (on the grid). */
  land: number;
  /** Scale degree of the chip, rising with the day. */
  degree: number;
};

export type WeekPlan = {
  bars: WeekBar[];
  archetype: string;
  monThuPercent: number;
  weekendPercent: number;
  rhythmHeadline: string;
  /** 0 steady ... 1 bursty. */
  position: number;
  topPercent: number;
  activeWeekPercent: number;
  firstYear: number;
  /** Seconds at which the rhythm bar starts to settle. */
  rhythmStart: number;
  duration: number;
};

const RHYTHM_HEADLINES: Record<RhythmLabel, string> = {
  steady: "Steady, week after week.",
  mixed: "Mostly steady, with bursts.",
  bursty: "Bursts and pauses.",
};

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** A short count for a narrow bar label: 1.2K, 52M. */
export function compactCount(value: number): string {
  return compactFormat.format(value);
}

const percent = (share: number) => Math.round(share * 100);

/** The week folded onto seven bars, plus the rhythm; null without activity. */
export function planWeekShape(history: History): WeekPlan | null {
  const days = history.years.flatMap((year) => year.dailyContributions);
  const shape = weekShape(days);
  const pace = rhythm(days);
  const firstYear = history.years.find(
    (year) => year.dailyContributions.length > 0,
  )?.year;
  if (shape.total === 0 || !shape.archetype || !pace.label || !firstYear) {
    return null;
  }

  const max = Math.max(...shape.weekdays);
  const bars = shape.weekdays.map((value, index) => {
    const start = quantizeUp(LEAD_SECONDS + index * STEP_SECONDS, GRID_SECONDS);
    return {
      index,
      name: NAMES[index] ?? "",
      short: (NAMES[index] ?? "").slice(0, 3),
      value,
      percent: percent(value / shape.total),
      ratio: max === 0 ? 0 : value / max,
      weekend: index >= 5,
      start,
      land: quantizeUp(start + GROW_SECONDS, GRID_SECONDS),
      degree: 2 + index * 2,
    };
  });
  const rhythmStart = bars.at(-1)?.land ?? 0;
  return {
    bars,
    archetype: shape.archetype,
    monThuPercent: percent(shape.monThuShare),
    weekendPercent: percent(shape.weekendShare),
    rhythmHeadline: RHYTHM_HEADLINES[pace.label],
    position: pace.position,
    topPercent: percent(pace.topDaysShare),
    activeWeekPercent: percent(pace.activeWeekShare),
    firstYear,
    rhythmStart,
    duration: rhythmStart + RHYTHM_SECONDS + TAIL_SECONDS,
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** How much of a bar is grown at `seconds`: an ease-out, no bounce. */
export function growthAt(
  bar: Pick<WeekBar, "start" | "land">,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || seconds >= bar.land) return 1;
  if (seconds <= bar.start) return 0;
  return 1 - (1 - clamp01((seconds - bar.start) / (bar.land - bar.start))) ** 3;
}

/** How far the rhythm marker has travelled toward its place, 0..1. */
export function rhythmProgressAt(
  plan: Pick<WeekPlan, "rhythmStart">,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1;
  return 1 - (1 - clamp01((seconds - plan.rhythmStart) / RHYTHM_SECONDS)) ** 3;
}

/** The sentence under the rhythm bar. */
export function rhythmLine(plan: WeekPlan): string {
  return `Your busiest 10% of days hold ${plan.topPercent}% of your contributions. Active in ${plan.activeWeekPercent}% of weeks.`;
}

/** The readout detail and spoken value for one bar. */
export function barDetail(bar: WeekBar): string {
  return `${formatCount(bar.value)} contributions · ${bar.percent}% of all`;
}

export function barReading(bar: WeekBar): string {
  return `${bar.name}: ${barDetail(bar)}`;
}
