import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import type { Plan } from "@/features/sequencer/model/plan";
import { topPercent } from "./chart";
import { type YearSlot, yearDetail, yearName, yearReading } from "./years";

/** Blocks other than the one under attention fade to this. */
const DIMMED = "0.35";
/** Left of this share of the width the readout opens to the right of the cursor. */
const FLIP_AT = 0.4;
/** Page Up/Down move this many years. */
const BIG_STEP = 5;

/**
 * Explore phase of the timeline: the scene is at its final state and each year
 * can be read. Pointer (mouse hover, touch press and drag) picks the year
 * under it; the chart is also one focusable slider, so Left/Right, Page and
 * Home/End step through the years and the exact value is spoken. A dashed
 * cursor and a dot mark the end of the picked year on the line, and the black
 * readout shows "YEAR · N this year · M total". Everything is an instant DOM
 * update: no timers, no sound, nothing animated on a clock of its own.
 */
export function exploreTimeline(
  root: HTMLElement,
  plan: Plan,
  slots: readonly YearSlot[],
): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const cursor = findElement<HTMLElement>(root, '[data-role="cursor"]');
  const line = findElement<HTMLElement>(cursor, "[data-cursor-line]");
  const dot = findElement<HTMLElement>(cursor, "[data-cursor-dot]");
  const readout = findElement<HTMLElement>(cursor, "[data-cursor-readout]");
  const title = findElement<HTMLElement>(readout, "[data-readout-year]");
  const detail = findElement<HTMLElement>(readout, "[data-readout-detail]");
  const bars = slots.map((_, index) =>
    findElement<HTMLElement>(root, `[data-bar="${index}"]`),
  );
  const count = slots.length;
  let current = count - 1;

  /** `null` shows the finished scene again. */
  const show = (picked: number | null) => {
    bars.forEach((bar, at) => {
      bar.style.opacity = picked === null || at === picked ? "" : DIMMED;
    });
    cursor.hidden = picked === null;
    const slot = picked === null ? undefined : slots[picked];
    if (picked === null || !slot) return;

    current = picked;
    const x = (picked + 1) / count;
    const left = `${(x * 100).toFixed(3)}%`;
    line.style.left = left;
    dot.style.left = left;
    dot.style.top = `${topPercent(plan, slot.endTotal)}%`;
    readout.style.left = left;
    readout.style.transform =
      x > FLIP_AT ? "translateX(calc(-100% - 12px))" : "translateX(12px)";
    title.textContent = yearName(slot);
    detail.textContent = yearDetail(slot);
    scrub.setAttribute("aria-valuenow", String(picked));
    scrub.setAttribute("aria-valuetext", yearReading(slot));
  };

  const pick = (event: PointerEvent) =>
    show(indexAtPointer(event.clientX, scrub.getBoundingClientRect(), count));
  const onPointerLeave = (event: PointerEvent) => {
    // A finger lifting is not the pointer leaving: the reading stays.
    if (event.pointerType === "mouse") show(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = indexAfterKey(event.key, current, count, {
      bigStep: BIG_STEP,
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
