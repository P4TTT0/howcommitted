import type { History } from "@/domain/history";
import type { DailyCommits } from "@/domain/types";
import type { YearBlock } from "@/domain/year-summary";
import { formatCount } from "./format";
import { buildPlan, type Plan, type StepInput } from "./plan";

const MS_PER_DAY = 86_400_000;

/** A year where the real daily commits and the official total disagree. */
export type YearGap = {
  year: number;
  /** Official total minus the real daily commits placed on that year. */
  unattributed: number;
};

export type HistoryPlan = {
  plan: Plan;
  /** Official yearly commit totals, oldest first. */
  yearBlocks: YearBlock[];
  /** Null when the history has no years at all. */
  firstYear: number | null;
  lastYear: number | null;
  /** Years whose daily detail does not add up to the official total. */
  gaps: YearGap[];
  /** The years of `gaps`. */
  incompleteYears: number[];
  /** Honest note about incomplete daily detail, or null. */
  note: string | null;
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
    const commits =
      gap.unattributed === 1
        ? "1 commit"
        : `${formatCount(gap.unattributed)} commits`;
    const verb = gap.unattributed === 1 ? "is" : "are";
    return `${commits} in ${gap.year} ${verb} not attributed to a day; yearly totals are exact.`;
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
 * the account's creation) to the last, with quiet days as zeros. The official
 * yearly totals are the truth for the counter and the year blocks, while the
 * days carry only real daily commits. Whatever a year's official total has
 * beyond them becomes one explicit step at the end of that year (see
 * UnattributedStep): never spread across days, never scaled. Days beyond the
 * official total are never scaled down either; the year is flagged instead.
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
    };
  }

  const byYear = new Map(history.years.map((entry) => [entry.year, entry]));
  const commitDates = history.years
    .flatMap((entry) => entry.dailyCommits.map((day) => day.date))
    .sort();
  const firstCommit = commitDates[0];
  const lastCommit = commitDates.at(-1);

  const created = history.user.createdAt.slice(0, 10);
  let rangeStart = Date.UTC(first.year, 0, 1);
  if (Number(created.slice(0, 4)) === first.year) {
    rangeStart = Math.max(rangeStart, dayStart(created));
  }
  if (firstCommit && Number(firstCommit.slice(0, 4)) === first.year) {
    rangeStart = Math.min(rangeStart, dayStart(firstCommit));
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
        lastCommit ? dayStart(lastCommit) : 0,
      ),
    );
  }

  const days: DailyCommits[] = [];
  const steps: StepInput[] = [];
  const gaps: YearGap[] = [];
  for (let year = first.year; year <= last.year; year += 1) {
    const entry = byYear.get(year);
    const counts = new Map(
      entry?.dailyCommits.map((day) => [day.date, day.commits]) ?? [],
    );
    const from = Math.max(rangeStart, Date.UTC(year, 0, 1));
    const to = Math.min(rangeEnd, Date.UTC(year, 11, 31));
    const dates: string[] = [];
    for (let ms = from; ms <= to; ms += MS_PER_DAY) dates.push(isoDay(ms));

    // Real commits only. Entries dated outside the range are not placed.
    const commits = dates.map((date) => counts.get(date) ?? 0);
    for (const [index, date] of dates.entries()) {
      days.push({ date, commits: commits[index] ?? 0 });
    }

    // The plan's own comparison decides, not only the API's reconciliation.
    const unattributed = (entry?.totals.commits ?? 0) - sum(commits);
    if (unattributed !== 0 && days.length > 0) {
      steps.push({ year, dayIndex: days.length - 1, amount: unattributed });
    }
    if (unattributed !== 0 || (entry && !entry.reconciliation.matches)) {
      gaps.push({ year, unattributed });
    }
  }

  return {
    plan: buildPlan(days, steps),
    yearBlocks,
    firstYear: first.year,
    lastYear: last.year,
    gaps,
    incompleteYears: gaps.map((gap) => gap.year),
    note: incompleteDetailNote(gaps),
  };
}
