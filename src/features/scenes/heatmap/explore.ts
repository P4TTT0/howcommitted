import type { HeatmapCell } from "@/domain/heatmap";
import { findElement } from "@/features/sequencer/explore";
import { cellIndexAt, cellReading, indexAfterGridKey } from "./plan";

/**
 * Explore phase: hover or press a day to read its date and contributions; the
 * grid is also one focusable slider (arrows move by day and week, the exact
 * value is spoken). Instantaneous DOM updates only: no sound, no timers.
 */
export function exploreHeatmap(
  root: HTMLElement,
  cells: readonly HeatmapCell[],
  weeks: number,
): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const reading = findElement<HTMLElement>(root, '[data-role="reading"]');
  const rest = reading.textContent ?? "";
  const elements = cells.map((_, index) =>
    findElement<HTMLElement>(root, `[data-cell="${index}"]`),
  );
  let current = cells.length - 1;
  let marked: HTMLElement | null = null;

  /** `null` shows the finished scene: the year total, nothing marked. */
  const show = (picked: number | null) => {
    if (marked) marked.style.outline = "";
    marked = null;
    const cell = picked === null ? undefined : cells[picked];
    if (picked === null || !cell) {
      reading.textContent = rest;
      return;
    }
    current = picked;
    marked = elements[picked] ?? null;
    if (marked) marked.style.outline = "2px solid #141414";
    const text = cellReading(cell);
    reading.textContent = text;
    scrub.setAttribute("aria-valuenow", String(picked));
    scrub.setAttribute("aria-valuetext", text);
  };

  const pick = (event: PointerEvent) => {
    const rect = scrub.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const week = Math.floor(((event.clientX - rect.left) / rect.width) * weeks);
    const weekday = Math.floor(((event.clientY - rect.top) / rect.height) * 7);
    const index = cellIndexAt(cells, week, weekday);
    if (index !== null) show(index);
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") show(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = indexAfterGridKey(event.key, current, cells.length);
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
