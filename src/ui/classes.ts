/** The one focus ring: a thick ink outline, only for keyboard focus. */
export const focusRing =
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Outlined action: Replay, Try again, Search again, the playback controls. */
export const actionClass = `inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-ink px-4 font-mono text-xs uppercase ${focusRing}`;
