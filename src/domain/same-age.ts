/**
 * Same-age alignment: puts developers on one axis counted from their own
 * first calendar year with a contribution, so a 2013 start and a 2021 start
 * can be read side by side. Pure; dates are UTC days.
 */

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

export type AgeInput = {
  /** Running total per day, on a shared daily axis. */
  series: readonly number[];
  /** Day number (days since the epoch) of `series[0]`. */
  startDay: number;
  /** Day number of the first contribution, or null when there is none. */
  firstDay: number | null;
};

export type SameAge = {
  /** Number of days on the aligned axis (at least 1). */
  length: number;
  /** One aligned series per input, all of `length`. */
  series: number[][];
  /**
   * Index of each developer's first contribution on the aligned axis, or null
   * when they have none.
   */
  firstIndex: (number | null)[];
};

/** Day number of January 1st of the year that contains `day`. */
export function yearStartOf(day: number): number {
  const year = new Date(day * MS_PER_DAY).getUTCFullYear();
  return Date.UTC(year, 0, 1) / MS_PER_DAY;
}

/**
 * Re-bases every series so index 0 is January 1st of that developer's first
 * contribution year. Before a series' own data the total is 0; after its last
 * day it is held, as in the calendar race. A developer without contributions
 * stays at 0 throughout.
 */
export function alignSameAge(inputs: readonly AgeInput[]): SameAge {
  const anchors = inputs.map((input) =>
    input.firstDay === null ? null : yearStartOf(input.firstDay),
  );
  let length = 1;
  inputs.forEach((input, lane) => {
    const anchor = anchors[lane];
    if (anchor === null || anchor === undefined) return;
    length = Math.max(length, input.startDay + input.series.length - anchor);
  });

  const series = inputs.map((input, lane) => {
    const anchor = anchors[lane];
    if (anchor === null || anchor === undefined) {
      return new Array<number>(length).fill(0);
    }
    const offset = anchor - input.startDay;
    const last = input.series.at(-1) ?? 0;
    return Array.from({ length }, (_, index) => {
      const source = index + offset;
      if (source < 0) return 0;
      return input.series[source] ?? last;
    });
  });

  const firstIndex = inputs.map((input, lane) => {
    const anchor = anchors[lane];
    if (input.firstDay === null || anchor === null || anchor === undefined) {
      return null;
    }
    return input.firstDay - anchor;
  });

  return { length, series, firstIndex };
}

/** The 1-based year of the aligned axis a day index falls in. */
export function ageYear(index: number): number {
  return Math.floor(Math.max(0, index) / DAYS_PER_YEAR) + 1;
}
