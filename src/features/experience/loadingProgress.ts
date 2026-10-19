/**
 * The history endpoint answers with one JSON body, so the client knows nothing
 * about years fetched or bytes streamed while it waits. Progress is therefore
 * an eased estimate of elapsed time: it moves fast at first, slows down, and
 * stays below 100 because only the arrival of the data ends the screen.
 */

export const PHRASES = [
  "Asking GitHub nicely",
  "Dusting off old commits",
  "Gathering twigs from every branch",
  "Counting squares, one by one",
  "Untangling the merge history",
  "Sorting Mondays from Sundays",
  "Finding the one you kept coming back to",
  "Almost there. Headphones on.",
] as const;

/**
 * Progress cells shown on the screen. They are not years: the account's years
 * are unknown until the history arrives, so a year label would be invented.
 */
export const PROGRESS_CELLS = 11;

/** Time for the estimate to cover about 63% of its range. */
const TAU_MS = 6000;
const CEILING = 99;

/** Whole percent in 0..99 for the time spent waiting. */
export function easedPercent(elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 0;
  return Math.min(
    CEILING,
    Math.floor(CEILING * (1 - Math.exp(-elapsedMs / TAU_MS))),
  );
}

/** Index of the phrase that matches a percentage; the last one is the end. */
export function phraseIndex(percent: number): number {
  const step = Math.floor((percent / 100) * PHRASES.length);
  return Math.max(0, Math.min(PHRASES.length - 1, step));
}

/** Fill of one cell, 0..1, as the percentage sweeps across the cells. */
export function cellFill(percent: number, index: number): number {
  const per = 100 / PROGRESS_CELLS;
  return Math.max(0, Math.min(1, (percent - index * per) / per));
}
