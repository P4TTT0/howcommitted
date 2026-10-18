import { activeDays, daysBetween, isoWeekStart } from "./activity";
import type { DailyContributions } from "./types";

export type RhythmLabel = "steady" | "mixed" | "bursty";

export type Rhythm = {
  /** Share of contributions that fall on the busiest 10% of active days, 0..1. */
  topDaysShare: number;
  /** Share of ISO weeks with any activity, within the active span, 0..1. */
  activeWeekShare: number;
  /** 0 = steady ... 1 = bursty. */
  position: number;
  /** Null without activity. */
  label: RhythmLabel | null;
};

/**
 * Steady or bursty. With n active days, the busiest k = ceil(n / 10) days hold
 * `topDaysShare` of all contributions. Concentration is how far that sits above
 * an even spread (k / n): (topDaysShare - k/n) / (1 - k/n), or 0 when k = n.
 * Gaps = 1 - activeWeekShare. position = (concentration + gaps) / 2.
 * Label: below 1/3 steady, above 2/3 bursty, otherwise mixed.
 */
export function rhythm(input: DailyContributions[]): Rhythm {
  const days = activeDays(input);
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) {
    return { topDaysShare: 0, activeWeekShare: 0, position: 0, label: null };
  }
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const k = Math.ceil(days.length / 10);
  const top = days
    .map((day) => day.count)
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, n) => sum + n, 0);
  const topDaysShare = top / total;

  const even = k / days.length;
  const concentration = even >= 1 ? 0 : (topDaysShare - even) / (1 - even);

  const weeks = new Set(days.map((day) => isoWeekStart(day.date)));
  const spanWeeks =
    daysBetween(isoWeekStart(first.date), isoWeekStart(last.date)) / 7 + 1;
  const activeWeekShare = weeks.size / spanWeeks;

  const position = Math.min(
    1,
    Math.max(0, (concentration + (1 - activeWeekShare)) / 2),
  );
  const label: RhythmLabel =
    position < 1 / 3 ? "steady" : position > 2 / 3 ? "bursty" : "mixed";
  return { topDaysShare, activeWeekShare, position, label };
}
