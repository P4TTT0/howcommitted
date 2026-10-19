/**
 * Pure helpers behind the sound gestures. No audio here: these only compute
 * times, rates and gates, so they are testable without an AudioContext.
 */

/** Pentatonic steps, in semitones, for a `stair` of up to ten items. */
export const STAIR_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] as const;

/** Semitones for step `index` of a stair; past the top it holds the top step. */
export function stairSemitones(index: number): number {
  const last = STAIR_SEMITONES.length - 1;
  const safe = Math.min(last, Math.max(0, Math.floor(index) || 0));
  return STAIR_SEMITONES[safe] ?? 0;
}

export const FILL_START_INTERVAL = 0.11;
export const FILL_END_INTERVAL = 0.03;
export const FILL_START_RATE = 0.8;
export const FILL_END_RATE = 1.7;

export type FillTick = {
  /** Seconds after the fill starts. */
  offset: number;
  rate: number;
};

/**
 * Ticks of a loading bar: they accelerate (about 110ms down to 30ms apart) and
 * rise in pitch (rate 0.8 to 1.7) over `duration`, then stop. Always includes
 * at least one tick for a positive duration.
 */
export function fillTicks(duration: number): FillTick[] {
  if (!(duration > 0)) return [];
  const ticks: FillTick[] = [];
  let offset = 0;
  while (offset < duration) {
    const progress = offset / duration;
    ticks.push({
      offset,
      rate: FILL_START_RATE + (FILL_END_RATE - FILL_START_RATE) * progress,
    });
    offset +=
      FILL_START_INTERVAL +
      (FILL_END_INTERVAL - FILL_START_INTERVAL) * progress;
  }
  return ticks;
}

const COUNT_START_RATE = 0.85;
const COUNT_END_RATE = 1.6;

/** Rate of a count tick at `progress` (0..1, clamped): it rises as the number climbs. */
export function countRate(progress: number): number {
  const p = Math.min(1, Math.max(0, progress || 0));
  return COUNT_START_RATE + (COUNT_END_RATE - COUNT_START_RATE) * p;
}

/**
 * Evenly spaced count ticks over `duration`: `steps` ticks, the last one
 * just before the closing hit at `duration`.
 */
export function countTicks(
  duration: number,
  steps: number,
): { offset: number; progress: number }[] {
  const n = Math.max(0, Math.floor(steps));
  if (n === 0 || !(duration > 0)) return [];
  return Array.from({ length: n }, (_, i) => ({
    offset: (duration * i) / n,
    progress: n === 1 ? 0 : i / (n - 1),
  }));
}

export const HOVER_MIN_RATE = 0.8;
export const HOVER_MAX_RATE = 1.4;

/** Hover playback rate for a 0..1 level (clamped): higher value, higher pitch. */
export function hoverRate(level: number): number {
  const l = Math.min(1, Math.max(0, level || 0));
  return HOVER_MIN_RATE + (HOVER_MAX_RATE - HOVER_MIN_RATE) * l;
}

/** Pops closer than this to the previous one share a grid slot and are dropped. */
export const POP_MIN_GAP = 0.045;

/**
 * Decides whether a pop at `time` is audible given the previous accepted pop.
 * Pops are expected in clock order; one landing in the same slot is dropped,
 * so a burst of hundreds of blocks never machine-guns.
 */
export function acceptPop(time: number, lastAccepted: number): boolean {
  return time - lastAccepted >= POP_MIN_GAP - 1e-9 || time < lastAccepted;
}

export const HOVER_THROTTLE_MS = 60;

export type HoverGate = { at: number; target: string | null };

/** Hover throttle: at most one per `HOVER_THROTTLE_MS`, and never twice for the same target in a row. */
export function allowHover(
  now: number,
  last: HoverGate,
  target: string | null,
): boolean {
  if (now - last.at < HOVER_THROTTLE_MS) return false;
  if (target !== null && target === last.target) return false;
  return true;
}
