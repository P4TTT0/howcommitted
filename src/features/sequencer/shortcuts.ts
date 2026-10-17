/** What a keyboard shortcut asks the sequencer to do. */
export type Shortcut = "toggle" | "prev" | "next" | "mute" | "cancel";

/** The shortcuts as documented to the user, for `aria-keyshortcuts` and hints. */
export const SHORTCUT_KEYS: Record<Shortcut, string> = {
  toggle: "Space",
  prev: "ArrowLeft",
  next: "ArrowRight",
  mute: "M",
  cancel: "Escape",
};

/** The parts of a keydown event the shortcuts care about. */
export type KeyInput = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  defaultPrevented: boolean;
  target: EventTarget | null;
};

/** Elements where the user is typing: no shortcut may fire from there. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== "string") return false;
  const tag = element.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    element.isContentEditable === true
  );
}

/** Elements that already do something with Space or Enter. */
function activatesOnSpace(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== "string") return false;
  const tag = element.tagName.toLowerCase();
  if (tag === "button" || tag === "a" || tag === "summary") return true;
  const role = element.getAttribute?.("role");
  return role === "button" || role === "radio" || role === "checkbox";
}

/**
 * Maps a keydown to a shortcut, or null when it must be left alone: while
 * typing, with a modifier (browser and OS shortcuts), when something already
 * handled it (a focused chart uses the arrows itself), and for Space on a
 * control that Space already activates.
 */
export function shortcutFor(input: KeyInput): Shortcut | null {
  if (input.defaultPrevented) return null;
  if (input.altKey || input.ctrlKey || input.metaKey) return null;
  if (isTyping(input.target)) return null;
  switch (input.key) {
    case " ":
    case "Spacebar":
      return activatesOnSpace(input.target) ? null : "toggle";
    case "ArrowLeft":
      return "prev";
    case "ArrowRight":
      return "next";
    case "m":
    case "M":
      return "mute";
    case "Escape":
      return "cancel";
    default:
      return null;
  }
}
