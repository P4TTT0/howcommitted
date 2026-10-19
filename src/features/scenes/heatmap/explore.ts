import { findElement } from "@/features/sequencer/explore";
import { interaction } from "@/playback/sound/interaction";
import {
  hoverLevel,
  positionAfterKey,
  tipDetail,
  tipTitle,
  WEEKS,
  weekReading,
  type YearRow,
} from "./plan";

/** Gap between a week and its tooltip, and the arrow's half-diagonal. */
const TIP_GAP = 10;
const ARROW = 6;

/**
 * Explore phase: tap, press or hover a week to read it in a black tooltip
 * ("12 contributions", "2022 · Apr 8 – Apr 14"). It sits above the week, shifts
 * inward near the edges and drops below when there is no room above. The grid
 * is also one focusable slider: arrows move a week or a year, Page Up/Down a
 * quarter, Home/End the first and last week, and the exact value is spoken.
 * Instant DOM updates only, no timers; the only sound is the hover pitch
 * through the interaction channel.
 */
export function exploreHeatmap(
  root: HTMLElement,
  rows: readonly YearRow[],
): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const host = findElement<HTMLElement>(root, '[data-role="tip-host"]');
  const scroller = findElement<HTMLElement>(root, '[data-role="grid-scroll"]');
  const tip = findElement<HTMLElement>(root, '[data-role="tip"]');
  const title = findElement<HTMLElement>(root, '[data-role="tip-title"]');
  const detail = findElement<HTMLElement>(root, '[data-role="tip-detail"]');
  const arrow = findElement<HTMLElement>(root, '[data-role="tip-arrow"]');
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

  /** Puts the tooltip over the marked week, kept inside the scene's content box. */
  const place = () => {
    if (!marked || tip.hidden) return;
    const hostBox = host.getBoundingClientRect();
    const cellBox = marked.getBoundingClientRect();
    const centre = cellBox.left + cellBox.width / 2 - hostBox.left;
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const left = Math.max(
      0,
      Math.min(centre - width / 2, hostBox.width - width),
    );
    const above = cellBox.top - hostBox.top - height - TIP_GAP;
    // No room above (first visible row): drop below the week instead.
    const flip = hostBox.top + above < 0;
    tip.style.left = `${left}px`;
    tip.style.top = `${flip ? cellBox.bottom - hostBox.top + TIP_GAP : above}px`;
    const arrowLeft = Math.max(
      ARROW,
      Math.min(centre - left - ARROW, width - ARROW * 3),
    );
    arrow.style.left = `${arrowLeft}px`;
    arrow.style.top = flip ? `${-ARROW}px` : "";
    arrow.style.bottom = flip ? "" : `${-ARROW}px`;
  };

  /** `null` hides the tooltip and clears the mark. */
  const show = (
    picked: { row: number; week: number } | null,
    scrollTo = false,
  ) => {
    if (marked) marked.style.outline = "";
    if (boldLabel) boldLabel.style.fontWeight = "";
    marked = null;
    boldLabel = null;
    const row = picked ? rows[picked.row] : undefined;
    const cell = picked ? row?.weeks[picked.week] : undefined;
    if (!picked || !row || !cell || cell.state !== "past") {
      interaction.leave();
      tip.hidden = true;
      return;
    }
    current = picked;
    interaction.hover(hoverLevel(cell), `${picked.row}:${picked.week}`);
    marked = root.querySelector<HTMLElement>(
      `[data-cell="${picked.row * WEEKS + picked.week}"]`,
    );
    if (marked) marked.style.outline = "3px solid #141414";
    boldLabel = labels[picked.row] ?? null;
    if (boldLabel) boldLabel.style.fontWeight = "700";
    title.textContent = tipTitle(cell.contributions);
    detail.textContent = tipDetail(row, cell);
    tip.hidden = false;
    if (scrollTo) marked?.scrollIntoView({ block: "nearest" });
    place();
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
    show(next, true);
  };
  const onFocus = () => show(current, true);
  const onBlur = () => show(null);

  scroller.addEventListener("scroll", place);
  scrub.hidden = false;
  scrub.tabIndex = 0;
  scrub.addEventListener("pointermove", pick);
  scrub.addEventListener("pointerdown", pick);
  scrub.addEventListener("pointerleave", onPointerLeave);
  scrub.addEventListener("keydown", onKeyDown);
  scrub.addEventListener("focus", onFocus);
  scrub.addEventListener("blur", onBlur);

  return () => {
    scroller.removeEventListener("scroll", place);
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
