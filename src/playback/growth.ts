/** Silent gaps shorter than this are bridged so a sparse stretch is not a stutter. */
const MERGE_GAP_SECONDS = 0.15;

/** Shorter than this a fill is just a click, so a short burst is stretched to it. */
const MIN_FILL_SECONDS = 0.2;

const WEEK_DAYS = 7;

export type GrowthRun = {
  start: number;
  duration: number;
  /** Running total's share (0..1) of the final total at the run's start. */
  from: number;
  /** Running total's share (0..1) of the final total at the run's end. */
  to: number;
};

/**
 * Stretches of the draw where the running total actually rises, so sound
 * follows growth and a flat line is silent. The cumulative is read in weeks
 * (never per commit); consecutive growing weeks form one run, and runs split
 * by a gap too short to hear are merged. A run shorter than the minimum is
 * still played, stretched to it, so an isolated burst is not lost.
 */
export function growthRuns(
  cumulative: readonly number[],
  drawSeconds: number,
): GrowthRun[] {
  const days = cumulative.length;
  const finalTotal = cumulative.at(-1) ?? 0;
  if (days === 0 || finalTotal <= 0) return [];

  const totalAt = (day: number) => (day > 0 ? (cumulative[day - 1] ?? 0) : 0);
  const secondsAt = (day: number) => (day / days) * drawSeconds;

  const runs: { startDay: number; endDay: number }[] = [];
  for (let first = 0; first < days; first += WEEK_DAYS) {
    const last = Math.min(first + WEEK_DAYS, days);
    if (totalAt(last) <= totalAt(first)) continue;
    const previous = runs.at(-1);
    if (
      previous &&
      secondsAt(first) - secondsAt(previous.endDay) < MERGE_GAP_SECONDS
    ) {
      previous.endDay = last;
    } else {
      runs.push({ startDay: first, endDay: last });
    }
  }

  return runs.map(({ startDay, endDay }, index) => {
    const start = secondsAt(startDay);
    // The stretch stops at the next run or the end of the draw, never past them.
    const next = runs[index + 1];
    const limit = next ? secondsAt(next.startDay) : drawSeconds;
    return {
      start,
      duration: Math.max(
        secondsAt(endDay) - start,
        Math.min(MIN_FILL_SECONDS, limit - start),
      ),
      from: totalAt(startDay) / finalTotal,
      to: totalAt(endDay) / finalTotal,
    };
  });
}
