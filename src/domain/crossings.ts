/**
 * Crossing points: the days a developer's running total moves past another's.
 * Pure. Ties never count as a crossing by themselves: a pass needs the other
 * line to have been ahead before and to be behind now.
 */

export type Crossing = {
  /** Index on the shared axis where the order changed. */
  index: number;
  /** Position (in the input order) of the series that moved ahead. */
  passer: number;
  /** Position of the series that was passed. */
  passed: number;
};

/**
 * Crossings of every pair, sorted by index, then by input order. The series
 * are expected to share one axis (the same length).
 */
export function findCrossings(
  series: readonly (readonly number[])[],
): Crossing[] {
  const crossings: Crossing[] = [];
  const length = Math.max(0, ...series.map((one) => one.length));
  for (let a = 0; a < series.length; a++) {
    for (let b = a + 1; b < series.length; b++) {
      const first = series[a] ?? [];
      const second = series[b] ?? [];
      // +1: a is ahead, -1: b is ahead, 0: no order established yet.
      let ahead = 0;
      for (let index = 0; index < length; index++) {
        const difference = (first[index] ?? 0) - (second[index] ?? 0);
        if (difference === 0) continue;
        const now = difference > 0 ? 1 : -1;
        if (ahead !== 0 && now !== ahead) {
          crossings.push(
            now > 0
              ? { index, passer: a, passed: b }
              : { index, passer: b, passed: a },
          );
        }
        ahead = now;
      }
    }
  }
  return crossings.sort(
    (x, y) => x.index - y.index || x.passer - y.passer || x.passed - y.passed,
  );
}

/** The last `count` crossings at or before `index`, oldest first. */
export function crossingsUpTo(
  crossings: readonly Crossing[],
  index: number,
  count: number,
): Crossing[] {
  const seen = crossings.filter((crossing) => crossing.index <= index);
  return seen.slice(Math.max(0, seen.length - count));
}

/** How many crossings happened at or before `index`. */
export function crossingCount(
  crossings: readonly Crossing[],
  index: number,
): number {
  return crossings.filter((crossing) => crossing.index <= index).length;
}
