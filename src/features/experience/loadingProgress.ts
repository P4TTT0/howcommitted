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

/** Extra phrases when several developers load together; playful, never judging. */
const VERSUS_PHRASES = [
  "Lining everyone up at the start",
  "Putting the names side by side",
] as const;

/** The phrases for a wait: the shared list, plus versus ones for 2 or more. */
export function phrasesFor(developers: number): readonly string[] {
  if (developers < 2) return PHRASES;
  return [
    PHRASES[0],
    VERSUS_PHRASES[0],
    ...PHRASES.slice(1, 5),
    VERSUS_PHRASES[1],
    ...PHRASES.slice(5),
  ];
}

/**
 * Background and text classes for the developer at `index` in a lineup: the
 * versus color, with whichever of ink or paper reads better on it. Full class
 * names so Tailwind keeps them.
 */
const PLAYER_BLOCKS = [
  "bg-versus-p1 text-paper",
  "bg-versus-p2 text-ink",
  "bg-versus-p3 text-ink",
  "bg-versus-p4 text-paper",
  "bg-versus-p5 text-ink",
] as const;

export function playerBlockClass(index: number): string {
  const n = PLAYER_BLOCKS.length;
  return PLAYER_BLOCKS[((index % n) + n) % n] as string;
}

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
export function phraseIndex(
  percent: number,
  count: number = PHRASES.length,
): number {
  const step = Math.floor((percent / 100) * count);
  return Math.max(0, Math.min(count - 1, step));
}

/** Fill of one cell, 0..1, as the percentage sweeps across the cells. */
export function cellFill(percent: number, index: number): number {
  const per = 100 / PROGRESS_CELLS;
  return Math.max(0, Math.min(1, (percent - index * per) / per));
}
