/**
 * Helpers for scenes' explore phase: turning a pointer position or a key into
 * the index of the data point under the user's attention. Pure, so every scene
 * (and its tests) can share them.
 */

/** Index of the slot under `clientX` when `count` equal slots span `rect`. */
export function indexAtPointer(
  clientX: number,
  rect: { left: number; width: number },
  count: number,
): number {
  if (count <= 0 || rect.width <= 0) return 0;
  const ratio = (clientX - rect.left) / rect.width;
  return Math.min(count - 1, Math.max(0, Math.floor(ratio * count)));
}

/**
 * Index after a navigation key on a focused chart, or null if the key is not
 * one. Left/Right move by `step`, PageUp/PageDown by `bigStep`, Home/End jump
 * to the ends.
 */
export function indexAfterKey(
  key: string,
  current: number,
  count: number,
  { step = 1, bigStep = 10 }: { step?: number; bigStep?: number } = {},
): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const clamp = (value: number) => Math.min(last, Math.max(0, value));
  switch (key) {
    case "ArrowLeft":
      return clamp(current - step);
    case "ArrowRight":
      return clamp(current + step);
    case "PageUp":
      return clamp(current - bigStep);
    case "PageDown":
      return clamp(current + bigStep);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

/** The element a scene's view must contain; throws so a broken scene is dropped. */
export function findElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing scene element: ${selector}`);
  return element;
}
