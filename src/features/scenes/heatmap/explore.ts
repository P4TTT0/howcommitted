import { findElement } from "@/features/sequencer/explore";
import {
  positionAfterKey,
  WEEKS,
  weekDetail,
  weekReading,
  weekTitle,
  type YearRow,
} from "./plan";

/**
 * Explore phase: tap, press or hover a week to read it in the black box
 * ("2022 · week 14", "12 contributions that week"). The grid is also one
 * focusable slider: arrows move a week or a year, Page Up/Down a quarter,
 * Home/End the first and last week, and the exact value is spoken. Instant DOM
 * updates only: no sound, no timers.
 */
export function exploreHeatmap(
  root: HTMLElement,
  rows: readonly YearRow[],
): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const title = findElement<HTMLElement>(root, '[data-role="readout-title"]');
  const detail = findElement<HTMLElement>(root, '[data-role="readout-detail"]');
  const restTitle = title.textContent ?? "";
  const restDetail = detail.textContent ?? "";
  const rowElements = rows.map((_, index) =>
    findElement<HTMLElement>(root, `[data-row="${index}"]`),
  );
  const labels = rows.map((_, index) =>
    findElement<HTMLElement>(
      rowElements[index] ?? root,
      '[data-role="row-label"]',
    ),
  );

  /** The newest readable week, where the keyboard starts. */
  const lastReadable = () => {
    for (let row = rows.length - 1; row >= 0; row -= 1) {
      const weeks = rows[row]?.weeks ?? [];
      for (let week = weeks.length - 1; week >= 0; week -= 1) {
        if (weeks[week]?.state === "past") return { row, week };
      }
    }
    return { row: 0, week: 0 };
  };
  let current = lastReadable();
  let marked: HTMLElement | null = null;
  let boldLabel: HTMLElement | null = null;

  /** `null` shows the finished scene: the whole range, nothing marked. */
  const show = (picked: { row: number; week: number } | null) => {
    if (marked) marked.style.outline = "";
    if (boldLabel) boldLabel.style.fontWeight = "";
    marked = null;
    boldLabel = null;
    const row = picked ? rows[picked.row] : undefined;
    const cell = picked ? row?.weeks[picked.week] : undefined;
    if (!picked || !row || !cell || cell.state !== "past") {
      title.textContent = restTitle;
      detail.textContent = restDetail;
      return;
    }
    current = picked;
    marked = root.querySelector<HTMLElement>(
      `[data-cell="${picked.row * WEEKS + picked.week}"]`,
    );
    if (marked) marked.style.outline = "3px solid #141414";
    boldLabel = labels[picked.row] ?? null;
    if (boldLabel) boldLabel.style.fontWeight = "700";
    title.textContent = weekTitle(row, picked.week);
    detail.textContent = weekDetail(cell.contributions);
    scrub.setAttribute(
      "aria-valuenow",
      String(picked.row * WEEKS + picked.week),
    );
    scrub.setAttribute("aria-valuetext", weekReading(row, cell));
  };

  /** The row under `clientY`, or the nearest one when it is in a gap. */
  const rowAt = (clientY: number): number => {
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    rowElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const away =
        clientY < rect.top
          ? rect.top - clientY
          : clientY > rect.bottom
            ? clientY - rect.bottom
            : 0;
      if (away < distance) {
        distance = away;
        nearest = index;
      }
    });
    return nearest;
  };

  const pick = (event: PointerEvent) => {
    const rect = scrub.getBoundingClientRect();
    if (rect.width <= 0) return;
    const week = Math.min(
      WEEKS - 1,
      Math.max(
        0,
        Math.floor(((event.clientX - rect.left) / rect.width) * WEEKS),
      ),
    );
    show({ row: rowAt(event.clientY), week });
  };
  const onPointerLeave = (event: PointerEvent) => {
    // A finger lifting is not the pointer leaving: the reading stays.
    if (event.pointerType === "mouse") show(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = positionAfterKey(event.key, current, rows);
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
