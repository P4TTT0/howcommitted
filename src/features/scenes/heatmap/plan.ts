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

/** Week columns per year row: a year touches up to 53 calendar weeks. */
export const WEEKS = 53;
/** Weeks busier than this share of the others all take the top level. */
const LEVEL_CAP_QUANTILE = 0.95;

/** The slice of a history year the heatmap needs. */
export type HeatmapYearInput = {
  year: number;
  totalContributions: number;
  heatmap: readonly HeatmapCell[];
};

export type WeekCell = {
  week: number;
  /** Contributions of every type in that week, not commits. */
  contributions: number;
  /** 0 = none, 1..4 = intensity (see `planRows`). Always 0 unless `state` is "past". */
  level: 0 | 1 | 2 | 3 | 4;
  /**
   * "past": a week with days to read. "future": it has not started yet
   * (drawn dashed). "absent": the calendar has no day in that column.
   */
  state: "past" | "future" | "absent";
  /** First and last ISO day the calendar has in that column, or null when empty. */
  from: string | null;
  to: string | null;
};

export type YearRow = {
  year: number;
  /** Position in the rotating block palette, from the first year: as on the timeline. */
  colorIndex: number;
  /** "2026 so far" for the year in progress. */
  label: string;
  /** The calendar's total for the year. */
  total: number;
  inProgress: boolean;
  weeks: WeekCell[];
};

/** ISO day (`YYYY-MM-DD`) of a date, in UTC. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The value below which `quantile` of the sorted values fall. */
function quantileOf(sorted: readonly number[], quantile: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(quantile * (sorted.length - 1))] ?? 0;
}

/**
 * One row per year, one cell per week. A week's level is its total against a
 * cap shared by every row: the 95th percentile of the weeks that had any
 * contribution, split into four equal steps. A shared cap keeps colors
 * comparable between years; the percentile keeps one freak week from washing
 * everything else out. A week is "future" when its first day is after `today`.
 */
export function planRows(
  years: readonly HeatmapYearInput[],
  today: Date,
): YearRow[] {
  const todayDay = isoDay(today);
  const currentYear = today.getUTCFullYear();
  const firstYear = years[0]?.year ?? 0;

  const rows = years.map((entry) => {
    const sums = new Array<number>(WEEKS).fill(0);
    const firstDay = new Array<string | null>(WEEKS).fill(null);
    const lastDay = new Array<string | null>(WEEKS).fill(null);
    for (const cell of entry.heatmap) {
      if (cell.week < 0 || cell.week >= WEEKS) continue;
      sums[cell.week] = (sums[cell.week] ?? 0) + cell.contributions;
      const earliest = firstDay[cell.week];
      if (earliest === null || cell.date < (earliest ?? "")) {
        firstDay[cell.week] = cell.date;
      }
      const latest = lastDay[cell.week];
      if (latest === null || cell.date > (latest ?? "")) {
        lastDay[cell.week] = cell.date;
      }
    }
    return { entry, sums, firstDay, lastDay };
  });

  const busy = rows
    .flatMap(({ sums }) => sums)
    .filter((sum) => sum > 0)
    .sort((a, b) => a - b);
  const cap = Math.max(1, quantileOf(busy, LEVEL_CAP_QUANTILE));

  return rows.map(({ entry, sums, firstDay, lastDay }) => {
    const inProgress = entry.year >= currentYear;
    const weeks = sums.map((contributions, week): WeekCell => {
      const start = firstDay[week] ?? null;
      // In the year in progress, a column without days is one still to come.
      let state: WeekCell["state"] = inProgress ? "future" : "absent";
      if (start !== null) state = start > todayDay ? "future" : "past";
      const level =
        state === "past" && contributions > 0
          ? (Math.min(4, Math.max(1, Math.ceil((contributions / cap) * 4))) as
              | 1
              | 2
              | 3
              | 4)
          : 0;
      return {
        week,
        contributions,
        level,
        state,
        from: start,
        to: lastDay[week] ?? null,
      };
    });
    return {
      year: entry.year,
      colorIndex: Math.max(0, entry.year - firstYear),
      label: inProgress ? `${entry.year} so far` : String(entry.year),
      total: entry.totalContributions,
      inProgress,
      weeks,
    };
  });
}

export type WeekPop = {
  time: number;
  /** Offset from the base pop level: softer for weeks without contributions. */
  db: number;
};

/** How much softer a pop is for a week with no contributions. */
export const EMPTY_WEEK_DB = -9;

export type HeatmapPlan = {
  weeks: number;
  /** Seconds at which each week column starts to appear, by week index. */
  weekTimes: number[];
  /** One pop per drawn week column, landing as the column does. */
  pops: WeekPop[];
  duration: number;
};

/** Contributions per week column, summed over every year. */
export function weeklyTotals(rows: readonly YearRow[]): number[] {
  const totals = new Array<number>(WEEKS).fill(0);
  for (const row of rows) {
    for (const cell of row.weeks) {
      totals[cell.week] = (totals[cell.week] ?? 0) + cell.contributions;
    }
  }
  return totals;
}

/** Reveal timing: week columns appear left to right; a pop per week column as it lands. */
export function planReveal(totals: readonly number[]): HeatmapPlan {
  const weeks = totals.length;
  const step =
    Math.max(1, Math.round(TARGET_REVEAL_SECONDS / weeks / GRID_SECONDS)) *
    GRID_SECONDS;
  const weekTimes = Array.from({ length: weeks }, (_, week) =>
    quantizeUp(LEAD_SECONDS + week * step, GRID_SECONDS),
  );

  // The pop lands when the column visibly does (ease-out: most of it is there
  // by half the fade), not when the fade starts. Every column gets one, softer
  // when the week is empty, so the rhythm never skips a step.
  const pops = weekTimes.map((time, week) => ({
    time: quantizeUp(time + FADE_SECONDS / 2, GRID_SECONDS),
    db: (totals[week] ?? 0) > 0 ? 0 : EMPTY_WEEK_DB,
  }));

  const lastTime = weekTimes.at(-1) ?? 0;
  return {
    weeks,
    weekTimes,
    pops,
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

/** Opacity of a row's color by level 1..4: a stepped scale, not a fade. */
export const LEVEL_ALPHA = [0, 0.3, 0.55, 0.8, 1] as const;

/** `#RRGGBB` as an `rgb()` color with an alpha. */
export function tint(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${value >> 16} ${(value >> 8) & 255} ${value & 255} / ${alpha})`;
}

/**
 * Cell position after a key on the focused grid, or null if it is not a grid
 * key. Left/Right move a week, Up/Down a year, Page Up/Down a quarter of the
 * year, Home/End go to the first and last readable cell. Positions are
 * `{ row, week }`; only readable weeks are landed on.
 */
export function positionAfterKey(
  key: string,
  current: { row: number; week: number },
  rows: readonly YearRow[],
): { row: number; week: number } | null {
  const readable = (row: number, week: number) =>
    rows[row]?.weeks[week]?.state === "past";
  const find = (
    row: number,
    week: number,
    dRow: number,
    dWeek: number,
  ): { row: number; week: number } => {
    // Walk in one direction to the nearest readable cell; stay put at an edge.
    let r = row + dRow;
    let w = week + dWeek;
    while (r >= 0 && r < rows.length && w >= 0 && w < WEEKS) {
      if (readable(r, w)) return { row: r, week: w };
      r += dRow;
      w += dWeek;
    }
    return current;
  };
  switch (key) {
    case "ArrowLeft":
      return find(current.row, current.week, 0, -1);
    case "ArrowRight":
      return find(current.row, current.week, 0, 1);
    case "ArrowUp":
      return find(current.row, current.week, -1, 0);
    case "ArrowDown":
      return find(current.row, current.week, 1, 0);
    case "PageUp":
      return find(current.row, current.week, 0, -13);
    case "PageDown":
      return find(current.row, current.week, 0, 13);
    case "Home":
    case "End": {
      const order = rows.flatMap((row, r) =>
        row.weeks.flatMap((cell) =>
          cell.state === "past" ? [{ row: r, week: cell.week }] : [],
        ),
      );
      return (key === "Home" ? order[0] : order.at(-1)) ?? current;
    }
    default:
      return null;
  }
}

/** The explore readout title: "2022 · week 14". */
export function weekTitle(row: Pick<YearRow, "year">, week: number): string {
  return `${row.year} · week ${week + 1}`;
}

/** The explore readout detail: "12 contributions that week". */
export function weekDetail(contributions: number): string {
  const unit = contributions === 1 ? "contribution" : "contributions";
  return `${formatCount(contributions)} ${unit} that week`;
}

/** Spoken reading of one week. */
export function weekReading(row: Pick<YearRow, "year">, cell: WeekCell) {
  return `${weekTitle(row, cell.week)}: ${weekDetail(cell.contributions)}`;
}

const MONTH_SHORT = [
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
] as const;

/** "2024-04-08" as "Apr 8", without going through a time zone. */
function shortDay(iso: string): string {
  const month = MONTH_SHORT[Number(iso.slice(5, 7)) - 1] ?? "";
  return `${month} ${Number(iso.slice(8, 10))}`;
}

/** The tooltip headline: "12 contributions". */
export function tipTitle(contributions: number): string {
  const unit = contributions === 1 ? "contribution" : "contributions";
  return `${formatCount(contributions)} ${unit}`;
}

/** The tooltip detail: "2024 · Apr 8 – Apr 14", the real dates of the week. */
export function tipDetail(
  row: Pick<YearRow, "year">,
  cell: Pick<WeekCell, "from" | "to">,
): string {
  if (!cell.from || !cell.to) return String(row.year);
  return `${row.year} · ${shortDay(cell.from)} – ${shortDay(cell.to)}`;
}

/** A week's 0..1 intensity for the hover pitch (level 0..4 over 4). */
export function hoverLevel(cell: Pick<WeekCell, "level">): number {
  return cell.level / 4;
}
