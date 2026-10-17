import { findElement, indexAfterKey } from "@/features/sequencer/explore";
import {
  formatBytes,
  formatShare,
  type LanguageBlock,
  languageReading,
} from "./blocks";

/** Blocks other than the one under attention fade to this. */
const DIMMED = "0.35";

/** Index of the block under `clientX`, matched on the shares' running edges. */
export function blockAtPointer(
  clientX: number,
  rect: { left: number; width: number },
  shares: readonly number[],
): number {
  if (shares.length === 0 || rect.width <= 0) return 0;
  const ratio = (clientX - rect.left) / rect.width;
  const total = shares.reduce((sum, share) => sum + share, 0) || 1;
  let edge = 0;
  for (const [index, share] of shares.entries()) {
    edge += share / total;
    if (ratio <= edge) return index;
  }
  return shares.length - 1;
}

/**
 * Explore phase of the mosaic: the scene is at its final state and each
 * language can be read. Hover or touch picks the block under the pointer; the
 * chart is also one focusable slider, so Left/Right, Page and Home/End step
 * through the blocks and the exact share and size are spoken. The readout shows
 * the picked language, its share and its bytes. Nothing here moves over time,
 * makes sound or keeps a clock.
 */
export function exploreLanguageMosaic(
  root: HTMLElement,
  blocks: readonly LanguageBlock[],
): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const readout = findElement<HTMLElement>(root, '[data-role="readout"]');
  const nameText = findElement<HTMLElement>(readout, '[data-role="name"]');
  const valueText = findElement<HTMLElement>(readout, '[data-role="value"]');
  const columns = blocks.map((_, index) =>
    findElement<HTMLElement>(root, `[data-block="${index}"]`),
  );
  const shares = blocks.map((block) => block.share);
  const last = blocks.length - 1;
  let current = last;

  /** `null` shows the finished scene: the last block, nothing dimmed. */
  const show = (picked: number | null) => {
    const index = picked ?? last;
    const block = blocks[index];
    if (!block) return;
    readout.style.backgroundColor = block.background;
    readout.style.color = block.foreground;
    nameText.textContent = block.name;
    valueText.textContent =
      picked === null
        ? formatShare(block.share)
        : `${formatShare(block.share)} · ${formatBytes(block.size)}`;
    columns.forEach((column, at) => {
      column.style.opacity = picked === null || at === picked ? "" : DIMMED;
    });
    if (picked !== null) {
      current = picked;
      scrub.setAttribute("aria-valuenow", String(picked));
      scrub.setAttribute("aria-valuetext", languageReading(block));
    }
  };

  const pick = (event: PointerEvent) =>
    show(blockAtPointer(event.clientX, scrub.getBoundingClientRect(), shares));
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") show(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = indexAfterKey(event.key, current, blocks.length, {
      bigStep: 5,
    });
    if (next === null) return;
    // The arrows belong to the chart while it is focused, not to the scenes.
    event.preventDefault();
    event.stopPropagation();
    show(next);
  };
  const onFocus = () => show(current);
  const onBlur = () => show(null);

  scrub.hidden = false;
  scrub.tabIndex = 0;
  scrub.addEventListener("pointermove", pick);
  scrub.addEventListener("pointerdown", pick);
  scrub.addEventListener("pointerleave", onPointerLeave);
  scrub.addEventListener("keydown", onKeyDown);
  scrub.addEventListener("focus", onFocus);
  scrub.addEventListener("blur", onBlur);

  return () => {
    scrub.removeEventListener("pointermove", pick);
    scrub.removeEventListener("pointerdown", pick);
    scrub.removeEventListener("pointerleave", onPointerLeave);
    scrub.removeEventListener("keydown", onKeyDown);
    scrub.removeEventListener("focus", onFocus);
    scrub.removeEventListener("blur", onBlur);
    show(null);
    scrub.tabIndex = -1;
    scrub.hidden = true;
  };
}
