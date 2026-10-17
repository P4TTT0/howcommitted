/**
 * Pitch mapping. Hits within a run climb a major pentatonic scale as the
 * run accumulates commits, so the pitch never sounds "wrong" and the climb
 * reads as tension building toward a payoff.
 */

const PENTATONIC = [0, 2, 4, 7, 9] as const;
const DEFAULT_MAX_DEGREE = 10;

export type PitchOptions = {
  /** Highest scale degree reached; the pitch holds there. */
  maxDegree?: number;
  /** Run accumulation at which the top degree is reached. */
  accumulationForMax?: number;
};

/** Scale degree for a run that has accumulated `accumulated` commits. */
export function degreeForAccumulation(
  accumulated: number,
  {
    maxDegree = DEFAULT_MAX_DEGREE,
    accumulationForMax = 900,
  }: PitchOptions = {},
): number {
  if (accumulated <= 0) return 0;
  const ratio = Math.sqrt(accumulated / accumulationForMax);
  return Math.min(maxDegree, Math.floor(ratio * maxDegree));
}

/**
 * Like `degreeForAccumulation`, but climbing from a starting `register`
 * (a scale degree) instead of the root. Reaches the top degree at the same
 * accumulation, so a run that starts higher simply climbs less far.
 */
export function degreeInRegister(
  accumulated: number,
  register: number,
  options: PitchOptions = {},
): number {
  const max = options.maxDegree ?? DEFAULT_MAX_DEGREE;
  const start = Math.min(max, Math.max(0, register));
  return (
    start +
    degreeForAccumulation(accumulated, { ...options, maxDegree: max - start })
  );
}

/** Rotates the restart point so consecutive runs never repeat a contour. */
const REGISTER_ROTATION = [0, 1, -1, 2] as const;
/** Fraction of the previous peak a new run restarts from. */
export const RESTART_RATIO = 0.5;
/** Restarts stay at least this far below the top so there is room to climb. */
const MIN_CLIMB_DEGREES = 3;

/**
 * Where a new run starts. Instead of dropping to the root (which makes every
 * restart sound the same) it keeps part of the previous register and rotates
 * a little by run number, so momentum carries across payoffs and gaps.
 */
export function restartRegister(
  previousPeak: number,
  run: number,
  maxDegree = DEFAULT_MAX_DEGREE,
): number {
  const base =
    Math.round(previousPeak * RESTART_RATIO) +
    (REGISTER_ROTATION[run % REGISTER_ROTATION.length] ?? 0);
  return Math.min(maxDegree - MIN_CLIMB_DEGREES, Math.max(0, base));
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

/** Quieter ticks per doubling of playback speed, so a fast run stays pleasant. */
const TICK_DB_PER_SPEED_DOUBLING = -3;

/**
 * Gain offset in dB for ticks at a playback speed. Speed never changes pitch
 * (samples are not resampled); it only packs more hits per second, which reads
 * louder, so ticks duck a little above 1x and are untouched at or below it.
 */
export function tickDbForSpeed(speed: number): number {
  if (!(speed > 1)) return 0;
  return TICK_DB_PER_SPEED_DOUBLING * Math.log2(speed);
}
