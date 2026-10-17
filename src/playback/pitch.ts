/**
 * Pitch mapping. Hits within a run climb a major pentatonic scale as the
 * run accumulates commits, so the pitch never sounds "wrong" and the climb
 * reads as tension building toward a payoff.
 */

const PENTATONIC = [0, 2, 4, 7, 9] as const;

export type PitchOptions = {
  /** Highest scale degree reached; the pitch holds there. */
  maxDegree?: number;
  /** Run accumulation at which the top degree is reached. */
  accumulationForMax?: number;
};

/** Scale degree for a run that has accumulated `accumulated` commits. */
export function degreeForAccumulation(
  accumulated: number,
  { maxDegree = 10, accumulationForMax = 900 }: PitchOptions = {},
): number {
  if (accumulated <= 0) return 0;
  const ratio = Math.sqrt(accumulated / accumulationForMax);
  return Math.min(maxDegree, Math.floor(ratio * maxDegree));
}

/** Semitones above the root for a pentatonic scale degree. */
export function semitonesForDegree(degree: number): number {
  const safe = Math.max(0, Math.floor(degree));
  const octave = Math.floor(safe / PENTATONIC.length);
  return 12 * octave + (PENTATONIC[safe % PENTATONIC.length] ?? 0);
}

/** Playback-rate multiplier for a pitch offset (equal temperament). */
export function rateForSemitones(semitones: number): number {
  return 2 ** (semitones / 12);
}

export function rateForCents(cents: number): number {
  return 2 ** (cents / 1200);
}

export type Variation = { cents: number; db: number };

/**
 * Small random pitch and volume offsets so repeated hits never sound
 * mechanical. The random source is injected to keep this testable.
 */
export function microVariation(
  random: () => number,
  { cents = 14, db = 1.5 }: { cents?: number; db?: number } = {},
): Variation {
  return {
    cents: (random() * 2 - 1) * cents,
    db: (random() * 2 - 1) * db,
  };
}
