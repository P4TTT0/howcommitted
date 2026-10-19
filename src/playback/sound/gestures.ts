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

/** Interval and rate at the ends of a short (2s or less) and a long (5s+) climb. */
const FILL_SHORT = { start: 0.11, end: 0.03, rateStart: 0.8, rateEnd: 1.7 };
const FILL_LONG = { start: 0.14, end: 0.06, rateStart: 0.85, rateEnd: 1.5 };
const FILL_SHORT_SECONDS = 2;
const FILL_LONG_SECONDS = 5;

export type FillTick = {
  /** Seconds after the fill starts. */
  offset: number;
  rate: number;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n || 0));

/** The look of a whole climb: longer climbs are gentler. */
function climbShape(climbSeconds: number) {
  const f = clamp01(
    (climbSeconds - FILL_SHORT_SECONDS) /
      (FILL_LONG_SECONDS - FILL_SHORT_SECONDS),
  );
  return {
    start: mix(FILL_SHORT.start, FILL_LONG.start, f),
    end: mix(FILL_SHORT.end, FILL_LONG.end, f),
    rateStart: mix(FILL_SHORT.rateStart, FILL_LONG.rateStart, f),
    rateEnd: mix(FILL_SHORT.rateEnd, FILL_LONG.rateEnd, f),
  };
}

/**
 * Ticks of a loading bar. A fill is a segment (`from`..`to`, 0..1) of one
 * overall climb: pitch and tick density follow the position on the climb, not
 * the segment's own progress, so consecutive segments continue each other.
 * Over the whole climb the ticks accelerate and rise in pitch; a long climb
 * (several seconds) goes from about 140ms to 60ms apart and rate 0.85 to 1.5,
 * a short one (2s or less) from 110ms to 30ms and rate 0.8 to 1.7. Always at
 * least one tick for a positive duration.
 */
export function fillTicks(duration: number, from = 0, to = 1): FillTick[] {
  if (!(duration > 0)) return [];
  const start = clamp01(from);
  const end = Math.max(start, clamp01(to));
  const span = end - start;
  const shape = climbShape(span > 0 ? duration / span : duration);
  const ticks: FillTick[] = [];
  let offset = 0;
  while (offset < duration) {
    const position = start + span * (offset / duration);
    ticks.push({
      offset,
      rate: mix(shape.rateStart, shape.rateEnd, position),
    });
    offset += mix(shape.start, shape.end, position);
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
