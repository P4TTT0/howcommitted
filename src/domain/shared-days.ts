/**
 * Shared days: for each day of a year, which developers contributed. A day
 * with several developers is drawn as one square split between them. Counts
 * are calendar contributions of any type, never commits. Pure; dates are UTC.
 */

const MS_PER_DAY = 86_400_000;

export type SharedDay = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Positions (in the order the developers were added) active that day. */
  people: number[];
};

export type SharedStats = {
  /** Days on which every developer contributed. */
  everyone: number;
  /** Days on which at least one developer contributed. */
  anyone: number;
  /** Longest run of consecutive days on which every developer contributed. */
  longestRun: number;
  /** Active days of each developer. */
  perPerson: number[];
};

/** Dates with at least one contribution. */
export function activeDates(
  days: readonly { date: string; count: number }[],
): Set<string> {
  const dates = new Set<string>();
  for (const { date, count } of days) if (count > 0) dates.add(date);
  return dates;
}

/**
 * Every day of `year`, January 1st up to `lastDate` (inclusive, or the end of
 * the year). Days after `lastDate` do not exist yet and are left out.
 */
export function sharedDays(
  year: number,
  active: readonly ReadonlySet<string>[],
  lastDate?: string,
): SharedDay[] {
  const days: SharedDay[] = [];
  const end = Date.UTC(year, 11, 31);
  const limit = lastDate
    ? Math.min(end, Date.parse(`${lastDate}T00:00:00Z`))
    : end;
  for (let ms = Date.UTC(year, 0, 1); ms <= limit; ms += MS_PER_DAY) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const people: number[] = [];
    active.forEach((dates, person) => {
      if (dates.has(date)) people.push(person);
    });
    days.push({ date, people });
  }
  return days;
}

export function sharedStats(
  days: readonly SharedDay[],
  people: number,
): SharedStats {
  const perPerson = new Array<number>(people).fill(0);
  let everyone = 0;
  let anyone = 0;
  let longestRun = 0;
  let run = 0;
  for (const day of days) {
    if (day.people.length > 0) anyone++;
    for (const person of day.people) {
      perPerson[person] = (perPerson[person] ?? 0) + 1;
    }
    if (people > 0 && day.people.length === people) {
      everyone++;
      run++;
      longestRun = Math.max(longestRun, run);
    } else {
      run = 0;
    }
  }
  return { everyone, anyone, longestRun, perPerson };
}

/** Days of the year on which at least two developers contributed. */
export function sharedCount(days: readonly SharedDay[]): number {
  return days.filter((day) => day.people.length >= 2).length;
}

/** Row of a date in a Monday-first week: Monday 0 ... Sunday 6. */
export function mondayFirstWeekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}
