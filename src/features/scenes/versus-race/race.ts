import { type Crossing, findCrossings } from "@/domain/crossings";
import { ageYear, alignSameAge } from "@/domain/same-age";
import {
  BPM,
  DRAW_SECONDS,
  GRID_SECONDS,
  type Plan,
} from "@/features/sequencer/model/plan";
import { dayNumber } from "@/playback/aggregate";

/**
 * The race model: every developer's running total on ONE shared daily axis,
 * either by calendar date or by years since each one's first contribution
 * year ("same age"). Lanes keep the order the developers were added in; the
 * view orders the bars by the running total at each moment (`laneOrder`) and
 * never numbers them. Pure, so the layout and the sound grid can be tested.
 */

export { BPM, DRAW_SECONDS };

const MS_PER_DAY = 86_400_000;

export type RaceEntry = { login: string; plan: Plan };

export type RaceMode = "calendar" | "age";

export type RaceLane = {
  login: string;
  /** Running total per shared day. 0 before the first day, held after the last. */
  series: number[];
  total: number;
  /** Index of the first contribution on this axis; null without any. */
  firstIndex: number | null;
};

export type Race = {
  mode: RaceMode;
  /** Calendar mode: day number (days since the epoch) of the first shared day. */
  startDay: number;
  /** Number of shared days. */
  length: number;
  /** In the order the developers were added. */
  lanes: RaceLane[];
  /** Highest total of any lane: the one fixed scale of every bar. */
  peak: number;
  /** The calendar years the data covers, in both modes. */
  firstYear: number;
  lastYear: number;
  /** Every time one line moved past another, oldest first. */
  crossings: Crossing[];
};

/** The same data on both axes; the toggle in the view picks one. */
export type Races = { calendar: Race; age: Race };

function laneSeries(
  plan: Plan,
  startDay: number,
  length: number,
): { series: number[]; total: number } {
  const series: number[] = [];
  let pointer = 0;
  let running = 0;
  for (let offset = 0; offset < length; offset++) {
    const day = startDay + offset;
    while (pointer < plan.days.length) {
      const date = plan.days[pointer]?.date;
      if (date === undefined || dayNumber(date) > day) break;
      running = plan.cumulative[pointer] ?? running;
      pointer++;
    }
    series.push(running);
  }
  return { series, total: series.at(-1) ?? 0 };
}

/** Day number of the first day with a contribution; null when none. */
function firstActiveDay(plan: Plan): number | null {
  const first = plan.days.find((day) => day.commits > 0);
  return first ? dayNumber(first.date) : null;
}

/** ISO date of a shared day (calendar mode). */
export function dateAtIndex(
  race: Pick<Race, "startDay">,
  index: number,
): string {
  return new Date((race.startDay + index) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function yearAtIndex(
  race: Pick<Race, "startDay">,
  index: number,
): number {
  return Number(dateAtIndex(race, index).slice(0, 4));
}

/** The big label of a moment: the calendar year, or "Year N" in same-age. */
export function yearLabel(race: Race, index: number): string {
  return race.mode === "age"
    ? `Year ${ageYear(index)}`
    : String(yearAtIndex(race, index));
}

/** The small label of a moment: the date, or the day count in same-age. */
export function dateLabel(race: Race, index: number): string {
  return race.mode === "age"
    ? `Day ${(index + 1).toLocaleString("en-US")}`
    : dateAtIndex(race, index);
}

/** A crossing's moment for the "Lines crossed" readout. */
export function whenLabel(race: Race, index: number): string {
  if (race.mode === "age") return `Year ${ageYear(index)}`;
  const [year, month] = dateAtIndex(race, index).split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
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
] as const;

/**
 * Both axes of the data, or null when nobody has a single day or nobody
 * contributed at all. They share lanes, peak and years.
 */
export function buildRaces(entries: readonly RaceEntry[]): Races | null {
  const firsts: number[] = [];
  const lasts: number[] = [];
  for (const { plan } of entries) {
    const first = plan.days[0];
    const last = plan.days.at(-1);
    if (!first || !last) continue;
    firsts.push(dayNumber(first.date));
    lasts.push(dayNumber(last.date));
  }
  if (firsts.length === 0) return null;
  const startDay = Math.min(...firsts);
  const length = Math.max(...lasts) - startDay + 1;
  const base = entries.map(({ login, plan }) => ({
    login,
    ...laneSeries(plan, startDay, length),
    firstDay: firstActiveDay(plan),
  }));
  const peak = Math.max(...base.map((lane) => lane.total));
  if (peak <= 0) return null;

  const firstYear = Number(new Date(startDay * MS_PER_DAY).getUTCFullYear());
  const lastYear = Number(
    new Date((startDay + length - 1) * MS_PER_DAY).getUTCFullYear(),
  );

  const calendarLanes: RaceLane[] = base.map((lane) => ({
    login: lane.login,
    series: lane.series,
    total: lane.total,
    firstIndex: lane.firstDay === null ? null : lane.firstDay - startDay,
  }));
  const calendar: Race = {
    mode: "calendar",
    startDay,
    length,
    lanes: calendarLanes,
    peak,
    firstYear,
    lastYear,
    crossings: findCrossings(calendarLanes.map((lane) => lane.series)),
  };

  const aligned = alignSameAge(
    base.map((lane) => ({
      series: lane.series,
      startDay,
      firstDay: lane.firstDay,
    })),
  );
  const ageLanes: RaceLane[] = base.map((lane, index) => ({
    login: lane.login,
    series: aligned.series[index] ?? [],
    total: lane.total,
    firstIndex: aligned.firstIndex[index] ?? null,
  }));
  const age: Race = {
    mode: "age",
    startDay,
    length: aligned.length,
    lanes: ageLanes,
    peak,
    firstYear,
    lastYear,
    crossings: findCrossings(ageLanes.map((lane) => lane.series)),
  };

  return { calendar, age };
}

/** The calendar race alone, for callers that do not need the toggle. */
export function buildRace(entries: readonly RaceEntry[]): Race | null {
  return buildRaces(entries)?.calendar ?? null;
}

/** The shared day under a progress through the race (0..1). */
export function indexAtProgress(race: Race, progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.min(race.length - 1, Math.floor(clamped * race.length));
}

/** Every lane's running total on a shared day, in lane order. */
export function valuesAtIndex(race: Race, index: number): number[] {
  return race.lanes.map((lane) => lane.series[index] ?? 0);
}

/**
 * Lane positions from the top bar to the bottom one: the largest running
 * total first, ties in the order the developers were added. Only a visual
 * order of the bars; nothing is ranked or numbered.
 */
export function laneOrder(values: readonly number[]): number[] {
  return values
    .map((value, lane) => ({ value, lane }))
    .sort((a, b) => b.value - a.value || a.lane - b.lane)
    .map(({ lane }) => lane);
}

/**
 * True while this lane has not made its first contribution on the axis and
 * has nothing counted yet. A developer with no contribution at all is simply 0.
 */
export function notThereYet(
  lane: RaceLane,
  index: number,
  value: number,
): boolean {
  return value === 0 && lane.firstIndex !== null && index < lane.firstIndex;
}

/** The most year labels the axis shows; the rest is skipped evenly. */
const MAX_AXIS_LABELS = 8;
/** Labels starting past this point would run off the right edge. */
const LAST_LABEL_START = 0.9;

/** The labels the axis really draws, thinned so they never collide or overflow. */
export function axisLabels(
  race: Race,
): { label: string; startProgress: number }[] {
  const marks = yearMarks(race);
  const every = Math.ceil(marks.length / MAX_AXIS_LABELS);
  return marks.filter(
    (mark, index) =>
      index % every === 0 && mark.startProgress <= LAST_LABEL_START,
  );
}

/** First day of each calendar year on the axis, with where it falls (0..1). */
export function yearMarks(
  race: Race,
): { label: string; startProgress: number }[] {
  const marks: { label: string; startProgress: number }[] = [];
  if (race.mode === "age") {
    for (let year = 1; year <= ageYear(race.length - 1); year++) {
      const index = Math.round((year - 1) * 365.25);
      marks.push({ label: `Y${year}`, startProgress: index / race.length });
    }
    return marks;
  }
  let previous: number | null = null;
  for (let index = 0; index < race.length; index++) {
    const year = yearAtIndex(race, index);
    if (previous !== year) {
      marks.push({ label: String(year), startProgress: index / race.length });
      previous = year;
    }
  }
  return marks;
}

/** Seconds between ticks: a quarter note, so the sound stays aggregated. */
export const TICK_SECONDS = GRID_SECONDS * 4;

/**
 * Which lanes grew during each tick of the drawing window, in lane order. A
 * tick is one aggregated hit per growing developer, never one per contribution.
 */
export function growthSlots(race: Race): { time: number; lanes: number[] }[] {
  const count = Math.floor(DRAW_SECONDS / TICK_SECONDS);
  const slots: { time: number; lanes: number[] }[] = [];
  let previous = 0;
  for (let slot = 1; slot <= count; slot++) {
    const index = indexAtProgress(race, slot / count);
    const grown: number[] = [];
    race.lanes.forEach((lane, laneIndex) => {
      const before = previous > 0 ? (lane.series[previous - 1] ?? 0) : 0;
      if ((lane.series[index] ?? 0) > before) grown.push(laneIndex);
    });
    previous = index + 1;
    slots.push({ time: (slot - 1) * TICK_SECONDS, lanes: grown });
  }
  return slots;
}

/** What assistive tech reads for a day: the moment and every lane, in lane order. */
export function dayReading(race: Race, index: number): string {
  const values = valuesAtIndex(race, index);
  const parts = race.lanes.map(
    (lane, laneIndex) =>
      `@${lane.login} ${(values[laneIndex] ?? 0).toLocaleString("en-US")}`,
  );
  const moment =
    race.mode === "age"
      ? `${yearLabel(race, index)}, ${dateLabel(race, index)}`
      : dateAtIndex(race, index);
  return `${moment}: ${parts.join(", ")} contributions so far`;
}
