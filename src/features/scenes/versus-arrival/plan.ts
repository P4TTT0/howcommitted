import { GRID_SECONDS } from "@/features/sequencer/model/plan";
import type { VersusEntry } from "@/features/sequencer/types";
import { dayNumber } from "@/playback/aggregate";

/**
 * The arrival model: for every developer when the account was created, when
 * the first contribution came and where both sit on one shared time axis,
 * plus the two plain sentences under the chart. Pure, so layout, copy and
 * timing can be tested. Nothing here ranks anyone.
 */

const MS_PER_DAY = 86_400_000;
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
] as const;

/** Most year labels on the axis; the rest is skipped evenly. */
const MAX_TICKS = 6;
/** Labels starting past this point would run off the right edge. */
const LAST_TICK_START = 0.88;

export type ArrivalRow = {
  /** Position in the order the developers were added: also the color. */
  index: number;
  login: string;
  /** "Mar 2011", or null when the account date is unknown. */
  joinedLabel: string | null;
  /** "Jan 2016", or null without any contribution. */
  firstLabel: string | null;
  /** Position on the axis (0..1) of the account creation, or null. */
  joinedAt: number | null;
  /** Position on the axis of the first contribution, or null. */
  firstAt: number | null;
  /** Days between creating the account and the first contribution, or null. */
  waitDays: number | null;
  /** How the row reads aloud. */
  reading: string;
};

export type Arrival = {
  rows: ArrivalRow[];
  ticks: { label: string; at: number }[];
  /** One or two plain statements, in the order they appear. */
  sentences: string[];
  /** Seconds on the clock at which row `i` starts drawing. */
  rowStarts: number[];
  /** Seconds the line of one row takes to draw. */
  rowSeconds: number;
  /** Seconds at which each sentence starts to fade in. */
  sentenceTimes: number[];
  sentenceSeconds: number;
  duration: number;
};

export const ROW_STEP_SECONDS = 0.6;
export const ROW_SECONDS = 1.4;
export const SENTENCE_STEP_SECONDS = 0.5;
export const SENTENCE_SECONDS = 0.5;
const FIRST_ROW_SECONDS = 0.5;
const TAIL_SECONDS = 2;
export const BPM = 140;

function quantize(seconds: number): number {
  return Math.round(seconds / GRID_SECONDS) * GRID_SECONDS;
}

function monthLabel(day: number): string {
  const date = new Date(day * MS_PER_DAY);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function dayOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / MS_PER_DAY);
}

function firstContributionDay(entry: VersusEntry): number | null {
  const first = entry.model.plan.days.find((day) => day.commits > 0);
  return first ? dayNumber(first.date) : null;
}

function lastDay(entry: VersusEntry): number | null {
  const last = entry.model.plan.days.at(-1);
  return last ? dayNumber(last.date) : null;
}

function plural(count: number, unit: string): string {
  return `${count.toLocaleString("en-US")} ${unit}${count === 1 ? "" : "s"}`;
}

function readingOf(
  login: string,
  joined: string | null,
  first: string | null,
): string {
  const parts = [
    joined ? `joined GitHub in ${joined}` : null,
    first ? `first contribution in ${first}` : "no contributions yet",
  ].filter(Boolean);
  return `@${login} ${parts.join(", ")}`;
}

/** Null when nobody has a date to place. */
export function buildArrival(entries: readonly VersusEntry[]): Arrival | null {
  const raw = entries.map((entry) => ({
    entry,
    joined: dayOf(entry.joinedAt),
    first: firstContributionDay(entry),
  }));

  const known = raw.flatMap(({ joined, first }) => [joined, first]);
  const dates = known.filter((day): day is number => day !== null);
  if (dates.length === 0) return null;

  const earliest = Math.min(...dates);
  const startYear = new Date(earliest * MS_PER_DAY).getUTCFullYear();
  const start = Date.UTC(startYear, 0, 1) / MS_PER_DAY;
  const end = Math.max(
    ...dates,
    ...entries.flatMap((entry) => lastDay(entry) ?? []),
  );
  const span = Math.max(1, end - start);
  const at = (day: number | null) =>
    day === null ? null : Math.min(1, Math.max(0, (day - start) / span));

  const rows: ArrivalRow[] = raw.map(({ entry, joined, first }, index) => {
    const joinedLabel = joined === null ? null : monthLabel(joined);
    const firstLabel = first === null ? null : monthLabel(first);
    const wait = joined !== null && first !== null ? first - joined : null;
    return {
      index,
      login: entry.login,
      joinedLabel,
      firstLabel,
      joinedAt: at(joined),
      firstAt: at(first),
      waitDays: wait !== null && wait >= 0 ? wait : null,
      reading: readingOf(entry.login, joinedLabel, firstLabel),
    };
  });

  const sentences: string[] = [];
  const withJoined = raw.filter(({ joined }) => joined !== null);
  if (withJoined.length >= 2) {
    let earlier = withJoined[0];
    for (const candidate of withJoined) {
      if ((candidate.joined ?? 0) < (earlier?.joined ?? 0)) earlier = candidate;
    }
    if (earlier && earlier.joined !== null) {
      sentences.push(
        `@${earlier.entry.login} got here first, in ${monthLabel(earlier.joined)}.`,
      );
    }
  }
  const waits = rows.filter((row) => row.waitDays !== null);
  let quickest = waits[0];
  for (const row of waits) {
    if ((row.waitDays ?? 0) < (quickest?.waitDays ?? 0)) quickest = row;
  }
  if (quickest && quickest.waitDays !== null) {
    sentences.push(
      quickest.waitDays === 0
        ? `@${quickest.login} made a first contribution the day they joined.`
        : `@${quickest.login} started contributing ${plural(quickest.waitDays, "day")} after joining.`,
    );
  }

  const yearTicks: { label: string; at: number }[] = [];
  const endYear = new Date(end * MS_PER_DAY).getUTCFullYear();
  for (let year = startYear; year <= endYear; year++) {
    yearTicks.push({
      label: String(year),
      at: (Date.UTC(year, 0, 1) / MS_PER_DAY - start) / span,
    });
  }
  const every = Math.ceil(yearTicks.length / MAX_TICKS);
  const ticks = yearTicks.filter(
    (tick, index) => index % every === 0 && tick.at <= LAST_TICK_START,
  );

  const rowStarts = rows.map((_, index) =>
    quantize(FIRST_ROW_SECONDS + index * ROW_STEP_SECONDS),
  );
  const rowsEnd = (rowStarts.at(-1) ?? 0) + ROW_SECONDS;
  const sentenceTimes = sentences.map((_, index) =>
    quantize(rowsEnd + 0.2 + index * SENTENCE_STEP_SECONDS),
  );
  const contentEnd = (sentenceTimes.at(-1) ?? rowsEnd) + SENTENCE_SECONDS;

  return {
    rows,
    ticks,
    sentences,
    rowStarts,
    rowSeconds: ROW_SECONDS,
    sentenceTimes,
    sentenceSeconds: SENTENCE_SECONDS,
    duration: contentEnd + TAIL_SECONDS,
  };
}

/** Linear 0..1 progress of something that runs from `start` for `length` seconds. */
export function progressAt(
  seconds: number,
  start: number,
  length: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return seconds >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (seconds - start) / length));
}

/**
 * How much of a row's two segments is drawn at overall progress `p`: the
 * dashed wait first, then the solid bar, as one line moving to the right.
 */
export function segmentScales(
  row: Pick<ArrivalRow, "joinedAt" | "firstAt">,
  progress: number,
): { wait: number; bar: number } {
  const from = row.joinedAt ?? row.firstAt ?? 0;
  const firstAt = row.firstAt ?? from;
  const waitLength = Math.max(0, firstAt - from);
  const barLength = Math.max(0, 1 - firstAt);
  const total = waitLength + barLength;
  if (total <= 0)
    return { wait: progress >= 1 ? 1 : 0, bar: progress >= 1 ? 1 : 0 };
  const drawn = progress * total;
  return {
    wait: waitLength > 0 ? Math.min(1, drawn / waitLength) : 1,
    bar:
      barLength > 0
        ? Math.min(1, Math.max(0, drawn - waitLength) / barLength)
        : 1,
  };
}
