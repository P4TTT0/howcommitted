import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import type { YearBar } from "./bars";

/** Bars other than the one under attention fade to this. */
const DIMMED = "0.35";

/** Spoken and visible reading of one year. */
export function yearReading(bar: Pick<YearBar, "year" | "contributions">) {
  return `${bar.year}: ${formatCount(bar.contributions)} contributions`;
}

/**
 * Explore phase of the year blocks: the scene is at its final state and each
 * year can be read. Pointer (mouse hover, touch press and drag) picks the year
 * under it; the chart is also one focusable slider, so Left/Right, Page and
 * Home/End step through the years and the exact value is spoken. The big
 * readout above shows the picked year's calendar contributions. Nothing here
 * moves over time, makes sound or keeps a clock; it only rewrites the readout.
 */
export function exploreYearBlocks(
  root: HTMLElement,
  bars: readonly YearBar[],
): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const readout = findElement<HTMLElement>(root, '[data-role="readout"]');
  const yearText = findElement<HTMLElement>(readout, '[data-role="year"]');
  const valueText = findElement<HTMLElement>(readout, '[data-role="value"]');
  const columns = bars.map((_, index) =>
    findElement<HTMLElement>(root, `[data-bar="${index}"]`),
  );
  const last = bars.length - 1;
  let current = last;

  /** `null` shows the finished scene: the last year, nothing dimmed. */
  const show = (picked: number | null) => {
    const index = picked ?? last;
    const bar = bars[index];
    if (!bar) return;
    const colors = blockForYearIndex(bar.colorIndex);
    readout.style.backgroundColor = colors.background;
    readout.style.color = colors.foreground;
    yearText.textContent = String(bar.year);
    valueText.textContent = formatCount(bar.contributions);
    columns.forEach((column, at) => {
      column.style.opacity = picked === null || at === picked ? "" : DIMMED;
    });
    if (picked !== null) {
      current = picked;
      scrub.setAttribute("aria-valuenow", String(picked));
      scrub.setAttribute("aria-valuetext", yearReading(bar));
    }
  };

  const pick = (event: PointerEvent) =>
    show(
      indexAtPointer(event.clientX, scrub.getBoundingClientRect(), bars.length),
    );
  const onPointerLeave = (event: PointerEvent) => {
    // A finger lifting is not the pointer leaving: the reading stays.
    if (event.pointerType === "mouse") show(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = indexAfterKey(event.key, current, bars.length, {
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
