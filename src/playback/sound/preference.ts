/**
 * The one sound preference for the whole site, kept in localStorage so the
 * landing toggle and the sequencer's Sound button agree across pages and
 * reloads. "unset" means the visitor never chose.
 */

export type SoundPreference = "unset" | "on" | "off";

const KEY = "committed:sound";

type Store = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSoundPreference(
  store: Store | null = defaultStore(),
): SoundPreference {
  try {
    const stored = store?.getItem(KEY);
    return stored === "on" || stored === "off" ? stored : "unset";
  } catch {
    return "unset";
  }
}

export function writeSoundPreference(
  on: boolean,
  store: Store | null = defaultStore(),
): void {
  try {
    store?.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice just does not outlive this page.
  }
}

/** The landing is silent unless the visitor asked for sound. */
export function landingSoundOn(preference: SoundPreference): boolean {
  return preference === "on";
}

/** The experience keeps sound on after Play unless the visitor turned it off. */
export function experienceSoundOn(preference: SoundPreference): boolean {
  return preference !== "off";
}
