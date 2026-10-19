import { WEEKDAY_BUILDER_MIN, WEEKEND_REGULAR_MIN } from "./week-shape";

/**
 * The habits an award can name for one developer. Every field is a plain fact
 * about how they contribute, computed elsewhere from calendar days.
 */
export type AwardMetrics = {
  /** Days in a row with a contribution. */
  longestStreak: number;
  firstYear: number | null;
  /** Saturday and Sunday over total, 0..1. */
  weekendShare: number;
  /** Monday to Thursday over total, 0..1. */
  monThuShare: number;
  /** Most contributions on a single day. */
  busiestDay: number;
  /** Days without any contribution between two active days. */
  longestQuiet: number;
  activeDays: number;
  /** Years with at least one contribution. */
  activeYears: number;
  /** Most contributions in one calendar year. */
  busiestYear: number;
  averagePerActiveDay: number;
  /** Monday = 0. Null without activity. */
  favoriteWeekday: number | null;
  /** Null when the history does not carry them. */
  reviews: number | null;
  pullRequests: number | null;
};

export type Award = {
  id: string;
  /** Names a habit, never a rank. */
  title: string;
  /** The number, date or word shown big. */
  value: string;
  /** One line saying what `value` counts. */
  metric: string;
  /** Index into the developers passed to `buildAwards`. */
  person: number;
};

type Candidate = {
  id: string;
  title: string;
  metric: string;
  /** Which end of the value names the habit. */
  direction: "max" | "min";
  /** Null when the developer has nothing to show for it. */
  read(m: AwardMetrics): number | null;
  /** Values below this (above, for "min") do not describe the habit. */
  threshold?: number;
  format(value: number): string;
};

const DAYS = (n: number) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`;
const COUNT = (n: number) => n.toLocaleString("en-US");
const positive = (n: number) => (n > 0 ? n : null);

/**
 * In priority order: the earlier the candidate, the earlier it is handed out.
 * Every title is a habit ("Longest streak"), never a verdict.
 */
const CANDIDATES: readonly Candidate[] = [
  {
    id: "streak",
    title: "Longest streak",
    metric: "Most days in a row with a contribution",
    direction: "max",
    read: (m) => positive(m.longestStreak),
    format: DAYS,
  },
  {
    id: "earliest-start",
    title: "Earliest start",
    metric: "First year with a contribution",
    direction: "min",
    read: (m) => m.firstYear,
    format: (n) => `${n}`,
  },
  {
    id: "weekend",
    title: "Weekend regular",
    metric: "Of contributions on Saturdays and Sundays",
    direction: "max",
    read: (m) => positive(m.weekendShare),
    threshold: WEEKEND_REGULAR_MIN,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    id: "weekday",
    title: "Weekday builder",
    metric: "Of contributions from Monday to Thursday",
    direction: "max",
    read: (m) => positive(m.monThuShare),
    threshold: WEEKDAY_BUILDER_MIN,
    format: (n) => `${Math.round(n * 100)}%`,
  },
  {
    id: "reviews",
    title: "Reviewer",
    metric: "Code reviews on GitHub",
    direction: "max",
    read: (m) => (m.reviews === null ? null : positive(m.reviews)),
    format: COUNT,
  },
  {
    id: "single-day",
    title: "Biggest day",
    metric: "Contributions in a single day",
    direction: "max",
    read: (m) => positive(m.busiestDay),
    format: COUNT,
  },
  {
    id: "quiet",
    title: "Longest quiet stretch",
    metric: "Days without a contribution, then back",
    direction: "max",
    read: (m) => positive(m.longestQuiet),
    format: DAYS,
  },
  {
    id: "pull-requests",
    title: "PR opener",
    metric: "Pull requests opened on GitHub",
    direction: "max",
    read: (m) => (m.pullRequests === null ? null : positive(m.pullRequests)),
    format: COUNT,
  },
  {
    id: "active-days",
    title: "Active days",
    metric: "Days with at least one contribution",
    direction: "max",
    read: (m) => positive(m.activeDays),
    format: DAYS,
  },
  {
    id: "busiest-year",
    title: "Busiest year",
    metric: "Contributions in their busiest calendar year",
    direction: "max",
    read: (m) => positive(m.busiestYear),
    format: COUNT,
  },
  {
    id: "active-years",
    title: "Active years",
    metric: "Years with at least one contribution",
    direction: "max",
    read: (m) => positive(m.activeYears),
    format: (n) => `${n} ${n === 1 ? "year" : "years"}`,
  },
  {
    id: "heavy-days",
    title: "Big days",
    metric: "Contributions on an average active day",
    direction: "max",
    read: (m) => positive(m.averagePerActiveDay),
    format: (n) => n.toFixed(1),
  },
];

/** How many different awards exist; the poster says "Picked from N". */
export const AWARD_COUNT = CANDIDATES.length;

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * Fallback for a developer who wins none of the above: a fact about their own
 * week that does not depend on anyone else.
 */
function favoriteWeekdayAward(
  person: number,
  metrics: AwardMetrics,
): Award | null {
  if (metrics.favoriteWeekday === null) return null;
  return {
    id: "favorite-weekday",
    title: "Favorite weekday",
    value: WEEKDAY_NAMES[metrics.favoriteWeekday] ?? "",
    metric: "The weekday with the most contributions",
    person,
  };
}

/** The developer holding the one clear end of this candidate, or null. */
function holderOf(
  candidate: Candidate,
  people: readonly AwardMetrics[],
): { person: number; value: number } | null {
  const readings = people.map((metrics) => {
    const value = candidate.read(metrics);
    if (value === null) return null;
    if (candidate.threshold !== undefined) {
      if (candidate.direction === "max" && value < candidate.threshold) {
        return null;
      }
      if (candidate.direction === "min" && value > candidate.threshold) {
        return null;
      }
    }
    return value;
  });
  let best: { person: number; value: number } | null = null;
  let tied = false;
  readings.forEach((value, person) => {
    if (value === null) return;
    if (
      !best ||
      (candidate.direction === "max" ? value > best.value : value < best.value)
    ) {
      best = { person, value };
      tied = false;
    } else if (value === best.value) {
      tied = true;
    }
  });
  // Equal values name no one: an award is a difference, never a coin toss.
  return best && !tied ? best : null;
}

/** Awards per developer so the page keeps a fixed, readable size. */
export function awardsPerPerson(people: number): number {
  if (people <= 2) return 3;
  if (people <= 4) return 2;
  return 1;
}

/**
 * Hands out awards that name a habit. Each award goes to the one developer
 * whose habit stands out on it; ties and empty values name nobody. Each
 * developer gets at most `perPerson` awards, spread round by round so everyone
 * gets one before anyone gets a second. A developer who stands out on nothing
 * gets their favorite weekday instead. Awards come back grouped by developer,
 * in the order the developers were added.
 */
export function buildAwards(
  people: readonly AwardMetrics[],
  perPerson: number = awardsPerPerson(people.length),
): Award[] {
  const holders = CANDIDATES.map((candidate) => ({
    candidate,
    holder: holderOf(candidate, people),
  }));
  const taken = new Set<string>();
  const byPerson: Award[][] = people.map(() => []);

  for (let round = 0; round < perPerson; round += 1) {
    people.forEach((_, person) => {
      const mine = byPerson[person];
      if (!mine) return;
      const next = holders.find(
        ({ candidate, holder }) =>
          holder?.person === person && !taken.has(candidate.id),
      );
      if (!next?.holder) return;
      taken.add(next.candidate.id);
      mine.push({
        id: next.candidate.id,
        title: next.candidate.title,
        value: next.candidate.format(next.holder.value),
        metric: next.candidate.metric,
        person,
      });
    });
  }

  people.forEach((metrics, person) => {
    const mine = byPerson[person];
    if (mine && mine.length === 0) {
      const fallback = favoriteWeekdayAward(person, metrics);
      if (fallback) mine.push(fallback);
    }
  });
  return byPerson.flat();
}
