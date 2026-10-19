import { findElement, indexAfterKey } from "@/features/sequencer/explore";
import { interaction } from "@/playback/sound/interaction";
import type { Reading } from "./plan";

/** Up/Down walk a vertical list the way Left/Right walk a row. */
export function arrowKey(key: string): string {
  if (key === "ArrowUp") return "ArrowLeft";
  if (key === "ArrowDown") return "ArrowRight";
  return key;
}

/**
 * Explore phase: every repo bar and era tile becomes focusable. Hover, touch
 * or focus shows its numbers in the black readout. Arrow keys, Home and End
 * move between the items of the same group and stop there, since the same keys
 * otherwise change scene. Nothing here moves or keeps a clock; pointing at an item
 * only makes the quiet hover sound of the interaction channel.
 */
export function exploreMainRepo(
  root: HTMLElement,
  readings: readonly Reading[],
  levels: readonly number[] = [],
): () => void {
  const readout = findElement<HTMLElement>(root, '[data-role="readout"]');
  const title = findElement<HTMLElement>(readout, '[data-role="title"]');
  const detail = findElement<HTMLElement>(readout, '[data-role="detail"]');
  const items = [...root.querySelectorAll<HTMLElement>("[data-item]")];

  const show = (index: number | null) => {
    const reading = index === null ? undefined : readings[index];
    if (!reading) {
      readout.hidden = true;
      return;
    }
    title.textContent = reading.title;
    detail.textContent = reading.detail;
    readout.hidden = false;
  };

  const cleanups = items.map((item, index) => {
    const group = items.filter(
      (other) => other.dataset.group === item.dataset.group,
    );
    const onEnter = () => {
      show(index);
      interaction.hover(levels[index] ?? 0, `item-${index}`);
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      show(null);
      interaction.leave();
    };
    const onFocus = () => show(index);
    const onBlur = () => show(null);
    const onKeyDown = (event: KeyboardEvent) => {
      const next = indexAfterKey(
        arrowKey(event.key),
        group.indexOf(item),
        group.length,
        { bigStep: group.length },
      );
      if (next === null) return;
      event.preventDefault();
      event.stopPropagation();
      group[next]?.focus();
    };

    item.tabIndex = 0;
    item.addEventListener("pointerenter", onEnter);
    item.addEventListener("pointerdown", onEnter);
    item.addEventListener("pointerleave", onLeave);
    item.addEventListener("focus", onFocus);
    item.addEventListener("blur", onBlur);
    item.addEventListener("keydown", onKeyDown);
    return () => {
      item.removeEventListener("pointerenter", onEnter);
      item.removeEventListener("pointerdown", onEnter);
      item.removeEventListener("pointerleave", onLeave);
      item.removeEventListener("focus", onFocus);
      item.removeEventListener("blur", onBlur);
      item.removeEventListener("keydown", onKeyDown);
      item.removeAttribute("tabindex");
    };
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
    show(null);
  };
}
