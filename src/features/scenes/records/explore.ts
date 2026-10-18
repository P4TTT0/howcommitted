import { findElement } from "@/features/sequencer/explore";
import type { RecordsPlan } from "./plan";

/**
 * Explore phase: each tile becomes focusable; hovering or focusing one inverts
 * it (ink on paper) so the pick is clear, and its full reading is already the
 * accessible name. Nothing moves, makes sound or keeps a clock.
 */
export function exploreRecords(
  root: HTMLElement,
  plan: RecordsPlan,
): () => void {
  const cleanups = plan.tiles.map((_, index) => {
    const tile = findElement<HTMLElement>(root, `[data-tile="${index}"]`);
    const on = () => tile.setAttribute("data-picked", "");
    const off = () => tile.removeAttribute("data-picked");
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && document.activeElement !== tile) {
        off();
      }
    };
    // The arrows belong to the tile while it is focused, not to the scenes.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.stopPropagation();
      }
    };

    tile.tabIndex = 0;
    tile.addEventListener("pointerenter", on);
    tile.addEventListener("pointerleave", onPointerLeave);
    tile.addEventListener("focus", on);
    tile.addEventListener("blur", off);
    tile.addEventListener("keydown", onKeyDown);

    return () => {
      tile.removeEventListener("pointerenter", on);
      tile.removeEventListener("pointerleave", onPointerLeave);
      tile.removeEventListener("focus", on);
      tile.removeEventListener("blur", off);
      tile.removeEventListener("keydown", onKeyDown);
      off();
      tile.removeAttribute("tabindex");
    };
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
