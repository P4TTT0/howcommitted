import type { History } from "@/domain/history";
import type { DailyCommits } from "@/domain/types";
import type { YearBlock } from "@/domain/year-summary";
import { buildPlan, type Plan } from "./plan";

const MS_PER_DAY = 86_400_000;

export type HistoryPlan = {
  plan: Plan;
  /** Official yearly commit totals, oldest first. */
  yearBlocks: YearBlock[];
  /** Null when the history has no years at all. */
  firstYear: number | null;
  lastYear: number | null;
  /** Years whose daily detail does not add up to the official total. */
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

/**
 * Splits `target` into whole numbers proportional to `weights` (largest
 * remainder), so the parts add up exactly. All-zero weights spread evenly.
 */
export function distribute(
  weights: readonly number[],
  target: number,
): number[] {
  if (target <= 0 || weights.length === 0) return weights.map(() => 0);
  const weighted = sum(weights) > 0;
  const shares = weighted ? weights : weights.map(() => 1);
  const denominator = sum(shares);
  const exact = shares.map((share) => (share * target) / denominator);
  const parts = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const remainder = target - sum(parts);
  for (let k = 0; k < remainder; k += 1) {
    const slot = order[k];
    if (slot) parts[slot.index] = (parts[slot.index] ?? 0) + 1;
  }
  return parts;
}

export function incompleteDetailNote(years: readonly number[]): string | null {
  if (years.length === 0) return null;
  const where = years.length <= 3 ? years.join(", ") : `${years.length} years`;
  return `Daily detail incomplete for ${where}; totals are exact.`;
}

/**
 * Maps the history API payload onto the timeline plan.
 *
 * The line is drawn over every calendar day from the first active year (or
 * the account's creation) to the last, with quiet days as zeros. The official
 * yearly totals are the truth: when a year's summed daily commits fall short,
 * its days are scaled up proportionally so the counter ends on the official
 * number, and the plan reports the year so the UI can say so.
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
  const incompleteYears: number[] = [];
  for (let year = first.year; year <= last.year; year += 1) {
    const entry = byYear.get(year);
    const counts = new Map(
      entry?.dailyCommits.map((day) => [day.date, day.commits]) ?? [],
    );
    const from = Math.max(rangeStart, Date.UTC(year, 0, 1));
    const to = Math.min(rangeEnd, Date.UTC(year, 11, 31));
    const dates: string[] = [];
    for (let ms = from; ms <= to; ms += MS_PER_DAY) dates.push(isoDay(ms));

    let commits = dates.map((date) => counts.get(date) ?? 0);
    const official = entry?.totals.commits ?? 0;
    if (sum(commits) !== official) commits = distribute(commits, official);
    if (entry && !entry.reconciliation.matches) incompleteYears.push(year);
    dates.forEach((date, index) => {
      days.push({ date, commits: commits[index] ?? 0 });
    });
  }

  return {
    plan: buildPlan(days),
    yearBlocks,
    firstYear: first.year,
    lastYear: last.year,
    incompleteYears,
    note: incompleteDetailNote(incompleteYears),
  };
}
