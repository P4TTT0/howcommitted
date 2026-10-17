import type { CalendarDay } from "./types";

export type HeatmapCell = {
  date: string;
  /** Column index, counted from the first (possibly partial) week of the input. */
  week: number;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
  /** Contributions of every type, not commits. */
  contributions: number;
  /** 0 = none, 1..4 = intensity relative to the busiest day of this year only, not comparable across years. */
  level: 0 | 1 | 2 | 3 | 4;
};

const DAY_MS = 86_400_000;

/** Weekday by week grid built from contribution calendar days. */
export function buildHeatmap(days: CalendarDay[]): HeatmapCell[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  if (!first) return [];

  const max = Math.max(...sorted.map((day) => day.count));
  const startMs = Date.parse(`${first.date}T00:00:00Z`);

  return sorted.map((day) => {
    const dayOffset = Math.round(
      (Date.parse(`${day.date}T00:00:00Z`) - startMs) / DAY_MS,
    );
    return {
      date: day.date,
      week: Math.floor((dayOffset + first.weekday) / 7),
      weekday: day.weekday,
      contributions: day.count,
      level: levelFor(day.count, max),
    };
  });
}

function levelFor(count: number, max: number): HeatmapCell["level"] {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as
    | 1
    | 2
    | 3
    | 4;
}
