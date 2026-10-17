/**
 * The sound kits and the lab's remembered choice. Pure: no audio code, so the
 * selector and its persistence can be tested without a browser.
 */

export const KIT_IDS = ["bubble", "chips", "marimba"] as const;
export type KitId = (typeof KIT_IDS)[number];

export const DEFAULT_KIT: KitId = "bubble";

export const KIT_LABELS: Record<KitId, string> = {
  bubble: "Bubble",
  chips: "Chips",
  marimba: "Marimba",
};

export const KIT_STORAGE_KEY = "committed:lab:kit";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

/** localStorage, or undefined when the browser blocks access to it. */
export function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function isKitId(value: unknown): value is KitId {
  return KIT_IDS.some((id) => id === value);
}

/** The stored kit, or the default when missing, invalid or unreadable. */
export function readKit(storage: Storage | undefined): KitId {
  try {
    const stored = storage?.getItem(KIT_STORAGE_KEY);
    return isKitId(stored) ? stored : DEFAULT_KIT;
  } catch {
    return DEFAULT_KIT;
  }
}

/** Remembers the kit; storage can be blocked, so failures are ignored. */
export function writeKit(storage: Storage | undefined, kit: KitId): void {
  try {
    storage?.setItem(KIT_STORAGE_KEY, kit);
  } catch {
    // Remembering the choice is a convenience, never a requirement.
  }
}
