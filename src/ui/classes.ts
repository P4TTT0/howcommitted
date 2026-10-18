/** The one focus ring: a thick ink outline, only for keyboard focus. */
export const focusRing =
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Pressed feedback every clickable thing shares (cursor comes from globals.css). */
export const pressable =
  "motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 active:translate-y-0.5";

/** Outlined action: Replay, Try again, Search again, the playback controls. */
export const actionClass = `inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-ink px-4 font-mono text-xs uppercase hover:border-block-ultramarine hover:bg-block-ultramarine hover:text-paper ${pressable} ${focusRing}`;

/** The small mono label: 87.5% width, uppercase, wide tracking. */
export const labelClass =
  "font-mono text-xs uppercase tracking-[0.06em] [font-stretch:87.5%]";
