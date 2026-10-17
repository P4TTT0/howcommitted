/** Usernames the empty input types out, one after another. */
export const PLACEHOLDER_NAMES = [
  "torvalds",
  "gaearon",
  "sindresorhus",
  "tj",
  "yyx990803",
] as const;

/** The widest example, used to size the idle field. */
export const LONGEST_PLACEHOLDER: string = PLACEHOLDER_NAMES.reduce((a, b) =>
  b.length > a.length ? b : a,
);

/** One typed letter per tick. */
export const PLACEHOLDER_TICK_MS = 140;

/** Ticks a finished name stays on screen before the next one starts. */
export const PLACEHOLDER_HOLD_TICKS = 8;

/** What shows when nothing types: reduced motion, focus, or before mount. */
export const STATIC_PLACEHOLDER: string = PLACEHOLDER_NAMES[0];

/**
 * The placeholder at a given tick of the typing cycle. Each name types in one
 * letter per tick, holds for `hold` ticks, then clears for one tick.
 */
export function placeholderAt(
  tick: number,
  names: readonly string[] = PLACEHOLDER_NAMES,
  hold: number = PLACEHOLDER_HOLD_TICKS,
): string {
  const total = names.reduce((sum, name) => sum + name.length + hold + 1, 0);
  let remaining = tick % total;
  for (const name of names) {
    const span = name.length + hold + 1;
    if (remaining < span) {
      if (remaining < name.length) return name.slice(0, remaining + 1);
      return remaining < name.length + hold ? name : "";
    }
    remaining -= span;
  }
  return STATIC_PLACEHOLDER;
}

/** `tick` is null when the animation is off (reduced motion, focus, typing). */
export function placeholderFor(tick: number | null): string {
  return tick === null ? STATIC_PLACEHOLDER : placeholderAt(tick);
}
