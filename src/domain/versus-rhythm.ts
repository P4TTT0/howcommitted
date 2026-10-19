/** Weekday counts (Monday first) as shares of their own total, 0..1. All zeros without activity. */
export function weekdayShares(weekdays: readonly number[]): number[] {
  const total = weekdays.reduce((sum, n) => sum + n, 0);
  return weekdays.map((n) => (total === 0 ? 0 : n / total));
}

/**
 * How much two weekly shapes lie on top of each other, 0..1: the sum, over the
 * seven weekdays, of the smaller of the two shares. Identical shapes give 1;
 * shapes that never share a weekday give 0. It compares habits, never volume:
 * each shape is taken as a share of its own total. Null if either side has no
 * activity.
 */
export function weekdayOverlap(
  a: readonly number[],
  b: readonly number[],
): number | null {
  const sharesA = weekdayShares(a);
  const sharesB = weekdayShares(b);
  if (sharesA.every((n) => n === 0) || sharesB.every((n) => n === 0)) {
    return null;
  }
  return sharesA.reduce(
    (sum, share, index) => sum + Math.min(share, sharesB[index] ?? 0),
    0,
  );
}

/** Index of the weekday (Monday = 0) with the most contributions; the earliest on ties. Null without activity. */
export function peakWeekday(weekdays: readonly number[]): number | null {
  let best: number | null = null;
  weekdays.forEach((count, index) => {
    if (count > 0 && (best === null || count > (weekdays[best] ?? 0))) {
      best = index;
    }
  });
  return best;
}

export type RhythmPair = {
  /** Indexes into the input, `a < b`. */
  a: number;
  b: number;
  overlap: number;
};

export type RhythmPairs = {
  closest: RhythmPair | null;
  /** Null when there is only one pair (or every pair overlaps equally). */
  furthest: RhythmPair | null;
};

/**
 * The two developers whose weeks overlap the most and the two whose weeks
 * overlap the least. Developers without activity are left out. On ties the
 * earliest pair in the order they were added wins. A description of two
 * shapes, not a ranking of people.
 */
export function rhythmPairs(
  weeks: readonly (readonly number[])[],
): RhythmPairs {
  const pairs: RhythmPair[] = [];
  for (let a = 0; a < weeks.length; a += 1) {
    for (let b = a + 1; b < weeks.length; b += 1) {
      const overlap = weekdayOverlap(weeks[a] ?? [], weeks[b] ?? []);
      if (overlap !== null) pairs.push({ a, b, overlap });
    }
  }
  let closest: RhythmPair | null = null;
  let furthest: RhythmPair | null = null;
  for (const pair of pairs) {
    if (!closest || pair.overlap > closest.overlap) closest = pair;
    if (!furthest || pair.overlap < furthest.overlap) furthest = pair;
  }
  if (closest && furthest && closest.overlap === furthest.overlap) {
    furthest = null;
  }
  return { closest, furthest };
}
