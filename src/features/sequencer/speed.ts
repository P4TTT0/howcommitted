/** Playback speeds offered to the user, slowest first. */
export const SPEEDS = [0.5, 1, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

export const DEFAULT_SPEED: Speed = 1;

const KEY = "committed:speed";

type Store = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): Store | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** "0.5×", "1×", "1.5×", "2×". */
export function speedLabel(speed: number): string {
  return `${speed}×`;
}

/** The speed after `speed` in the list, wrapping around (for a one-tap cycle). */
export function nextSpeed(speed: number): Speed {
  const index = (SPEEDS as readonly number[]).indexOf(speed);
  return SPEEDS[(index + 1) % SPEEDS.length] ?? DEFAULT_SPEED;
}

/** The speed chosen earlier in this browser session, or 1. */
export function readSpeed(store: Store | null = defaultStore()): Speed {
  try {
    const stored = Number(store?.getItem(KEY));
    return SPEEDS.find((speed) => speed === stored) ?? DEFAULT_SPEED;
  } catch {
    return DEFAULT_SPEED;
  }
}

export function writeSpeed(
  speed: Speed,
  store: Store | null = defaultStore(),
): void {
  try {
    store?.setItem(KEY, String(speed));
  } catch {
    // Storage blocked: the speed just does not outlive this page.
  }
}
