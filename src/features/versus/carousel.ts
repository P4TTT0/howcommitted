/** Pure helpers of the phone carousel; the DOM side lives in `mountCarousel.ts`. */

/**
 * The slide to show at `seconds` while the scene plays: the latest one whose
 * reveal time has passed, and the first before any has.
 */
export function activeAt(seconds: number, times: readonly number[]): number {
  let active = 0;
  for (let index = 0; index < times.length; index += 1) {
    if (seconds >= (times[index] as number)) active = index;
  }
  return active;
}

/** `index` moved by `delta`, kept inside `0..count - 1`. */
export function stepIndex(index: number, delta: number, count: number): number {
  return Math.max(0, Math.min(count - 1, index + delta));
}

/** Slides to move from the active one to `index`: 0 is on screen. */
export function slideOffset(index: number, active: number): number {
  return index - active;
}

/** The swipe of `dx` px (negative is leftwards) as a step: 0 when too short. */
export function swipeStep(dx: number, threshold = 40): number {
  if (Math.abs(dx) < threshold) return 0;
  return dx < 0 ? 1 : -1;
}
