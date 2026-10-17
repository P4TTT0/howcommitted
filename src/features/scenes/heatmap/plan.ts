import type { HeatmapCell } from "@/domain/heatmap";
import { formatCount } from "@/features/sequencer/model/format";
import { quantizeUp } from "@/playback/schedule";

export const BPM = 120;
/** One sixteenth note at the tempo. */
export const GRID_SECONDS = 60 / BPM / 4;
const LEAD_SECONDS = 0.4;
/** Seconds one week column takes to fade in. */
export const FADE_SECONDS = 0.25;
const TAIL_SECONDS = 1.6;
const MIN_SECONDS = 4;
const TARGET_REVEAL_SECONDS = 5;
/** One tick per this many week columns: aggregated, never one per day. */
const WEEKS_PER_TICK = 4;
const MAX_DEGREE = 10;

export type Tick = { time: number; degree: number; intensity: number };

export type HeatmapPlan = {
  weeks: number;
  /** Seconds at which each week column starts to appear, by week index. */
  weekTimes: number[];
  ticks: Tick[];
  duration: number;
};

/** The latest year of the history that has any calendar days, or null. */
export function latestYearCells(
  years: readonly { year: number; heatmap: HeatmapCell[] }[],
): { year: number; cells: HeatmapCell[] } | null {
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const entry = years[i];
    if (entry && entry.heatmap.length > 0) {
      return { year: entry.year, cells: entry.heatmap };
    }
  }
  return null;
}

/** Reveal timing: week columns appear left to right; a tick per few weeks. */
export function planReveal(cells: readonly HeatmapCell[]): HeatmapPlan {
  const weeks = cells.reduce((max, cell) => Math.max(max, cell.week + 1), 0);
  const step =
    Math.max(1, Math.round(TARGET_REVEAL_SECONDS / weeks / GRID_SECONDS)) *
    GRID_SECONDS;
  const weekTimes = Array.from({ length: weeks }, (_, week) =>
    quantizeUp(LEAD_SECONDS + week * step, GRID_SECONDS),
  );

  const totals = new Array<number>(weeks).fill(0);
  for (const cell of cells) {
    totals[cell.week] = (totals[cell.week] ?? 0) + cell.contributions;
  }
  const groups = Math.ceil(weeks / WEEKS_PER_TICK);
  const sums = Array.from({ length: groups }, (_, group) =>
    totals
      .slice(group * WEEKS_PER_TICK, (group + 1) * WEEKS_PER_TICK)
      .reduce((a, b) => a + b, 0),
  );
  const peak = Math.max(1, ...sums);
  const ticks = sums
    .map((sum, group) => ({
      sum,
      time: weekTimes[group * WEEKS_PER_TICK] ?? 0,
      degree: Math.round((group * MAX_DEGREE) / Math.max(1, groups - 1)),
      intensity: 0.4 + 0.6 * (sum / peak),
    }))
    .filter((tick) => tick.sum > 0)
    .map(({ time, degree, intensity }) => ({ time, degree, intensity }));

  const lastTime = weekTimes.at(-1) ?? 0;
  return {
    weeks,
    weekTimes,
    ticks,
    duration: Math.max(MIN_SECONDS, lastTime + FADE_SECONDS + TAIL_SECONDS),
  };
}

/** 0..1 appearance of a week column at `seconds`. */
export function weekProgress(
  time: number,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (seconds < time) return 0;
  if (reducedMotion) return 1;
  const linear = Math.min(1, (seconds - time) / FADE_SECONDS);
  return 1 - (1 - linear) ** 3;
}

/** Index of the cell at a grid position, or null for an empty slot. */
export function cellIndexAt(
  cells: readonly HeatmapCell[],
  week: number,
  weekday: number,
): number | null {
  const index = cells.findIndex(
    (cell) => cell.week === week && cell.weekday === weekday,
  );
  return index === -1 ? null : index;
}

/** Cell index after a key on the focused grid, or null if not a grid key. */
export function indexAfterGridKey(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  const clamp = (value: number) => Math.min(count - 1, Math.max(0, value));
  switch (key) {
    case "ArrowUp":
      return clamp(current - 1);
    case "ArrowDown":
      return clamp(current + 1);
    case "ArrowLeft":
      return clamp(current - 7);
    case "ArrowRight":
      return clamp(current + 7);
    case "PageUp":
      return clamp(current - 28);
    case "PageDown":
      return clamp(current + 28);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Mar 4, 2025: 12 contributions" from an ISO date. */
export function cellReading(
  cell: Pick<HeatmapCell, "date" | "contributions">,
): string {
  const [year, month, day] = cell.date.split("-").map(Number);
  const name = MONTHS[(month ?? 1) - 1] ?? "";
  const unit = cell.contributions === 1 ? "contribution" : "contributions";
  return `${name} ${day}, ${year}: ${formatCount(cell.contributions)} ${unit}`;
}
