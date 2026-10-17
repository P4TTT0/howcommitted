import type { History } from "@/domain/history";
import type { DailyCommits } from "@/domain/types";
import type { YearBlock } from "@/domain/year-summary";
import { formatCount } from "./format";
import { buildPlan, type Plan, type StepInput } from "./plan";

const MS_PER_DAY = 86_400_000;

/** A year where the daily contributions and the calendar total disagree. */
export type YearGap = {
  year: number;
  /** Calendar total minus the daily contributions placed on that year. */
  unattributed: number;
};

export type HistoryPlan = {
  plan: Plan;
  /** Calendar yearly totals, oldest first. */
  yearBlocks: YearBlock[];
  /** Null when the history has no years at all. */
  firstYear: number | null;
  lastYear: number | null;
  /** Years whose daily detail does not add up to the calendar total. */
  gaps: YearGap[];
  /** The years of `gaps`. */
  incompleteYears: number[];
  /** Honest note about incomplete daily detail, or null. */
  note: string | null;
  /** Private contributions included in the total (a count only), 0 when none. */
  privateContributions: number;
};

function dayStart(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function incompleteDetailNote(gaps: readonly YearGap[]): string | null {
  const [gap] = gaps;
  if (!gap) return null;
  if (gaps.length > 1) {
    return `Daily detail incomplete for ${gaps.length} years; yearly totals are exact.`;
  }
  if (gap.unattributed > 0) {
    const contributions =
      gap.unattributed === 1
        ? "1 contribution"
        : `${formatCount(gap.unattributed)} contributions`;
    const verb = gap.unattributed === 1 ? "is" : "are";
    return `${contributions} in ${gap.year} ${verb} not attributed to a day; yearly totals are exact.`;
  }
  if (gap.unattributed < 0) {
    return `Daily detail for ${gap.year} exceeds its yearly total by ${formatCount(-gap.unattributed)}; yearly totals are exact.`;
  }
  return `Daily detail incomplete for ${gap.year}; yearly totals are exact.`;
}

/**
 * Maps the history API payload onto the timeline plan.
 *
 * The line is drawn over every calendar day from the first active year (or
 * the account's creation) to the last, with quiet days as zeros. The calendar
 * yearly totals (public and shared private contributions) are the truth for
 * the counter and the year blocks, while the days carry only the calendar's
 * daily counts. Whatever a year's calendar total has beyond them becomes one
 * explicit step at the end of that year (see UnattributedStep): never spread
 * across days, never scaled. Days beyond the calendar total are never scaled
 * down either; the year is flagged instead.
 */
export function planFromHistory(
  history: History,
  today: Date = new Date(),
): HistoryPlan {
  const first = history.years[0];
  const last = history.years.at(-1);
  const yearBlocks = history.yearBlocks;
  if (!first || !last) {
    return {
      plan: buildPlan([]),
      yearBlocks,
      firstYear: null,
      lastYear: null,
      gaps: [],
      incompleteYears: [],
      note: null,
      privateContributions: 0,
    };
  }

  const byYear = new Map(history.years.map((entry) => [entry.year, entry]));
  const activeDates = history.years
    .flatMap((entry) => entry.dailyContributions.map((day) => day.date))
    .sort();
  const firstActive = activeDates[0];
  const lastActive = activeDates.at(-1);

  const created = history.user.createdAt.slice(0, 10);
  let rangeStart = Date.UTC(first.year, 0, 1);
  if (Number(created.slice(0, 4)) === first.year) {
    rangeStart = Math.max(rangeStart, dayStart(created));
  }
  if (firstActive && Number(firstActive.slice(0, 4)) === first.year) {
    rangeStart = Math.min(rangeStart, dayStart(firstActive));
  }
  let rangeEnd = Date.UTC(last.year, 11, 31);
  if (last.year >= today.getUTCFullYear()) {
    rangeEnd = Math.min(
      rangeEnd,
      Math.max(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
        lastActive ? dayStart(lastActive) : 0,
      ),
    );
  }

  const days: DailyCommits[] = [];
  const steps: StepInput[] = [];
  const gaps: YearGap[] = [];
  for (let year = first.year; year <= last.year; year += 1) {
    const entry = byYear.get(year);
    const counts = new Map(
      entry?.dailyContributions.map((day) => [day.date, day.count]) ?? [],
    );
    const from = Math.max(rangeStart, Date.UTC(year, 0, 1));
    const to = Math.min(rangeEnd, Date.UTC(year, 11, 31));
    const dates: string[] = [];
    for (let ms = from; ms <= to; ms += MS_PER_DAY) dates.push(isoDay(ms));

    // Calendar counts only. Entries dated outside the range are not placed.
    // The playback day shape still names its count `commits`.
    const contributions = dates.map((date) => counts.get(date) ?? 0);
    for (const [index, date] of dates.entries()) {
      days.push({ date, commits: contributions[index] ?? 0 });
    }

    // The difference to the calendar total is an explicit step, never spread.
    const unattributed = (entry?.totalContributions ?? 0) - sum(contributions);
    if (unattributed !== 0 && days.length > 0) {
      steps.push({ year, dayIndex: days.length - 1, amount: unattributed });
    }
    if (unattributed !== 0) gaps.push({ year, unattributed });
  }

  return {
    plan: buildPlan(days, steps),
    yearBlocks,
    firstYear: first.year,
    lastYear: last.year,
    gaps,
    incompleteYears: gaps.map((gap) => gap.year),
    note: incompleteDetailNote(gaps),
    privateContributions: history.totals.privateContributions,
  };
}
