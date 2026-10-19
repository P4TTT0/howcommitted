import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import { interaction } from "@/playback/sound/interaction";
import { type BigNumber, BY_YEAR, yearReading } from "./numbers";

const DIMMED = "0.35";
const SLIDER_ATTRIBUTES = [
  "role",
  "aria-label",
  "aria-orientation",
  "aria-valuemin",
  "aria-valuemax",
  "aria-valuenow",
  "aria-valuetext",
];

/**
 * Explore phase: each number's year chart becomes one focusable slider over its
 * years, so the whole chart is the tap target at any year count. The pointer
 * snaps to the nearest column (press and move scrub, a tap picks); the arrows,
 * Home and End step through the years. The picked column stays solid, the rest
 * dim, and its reading shows above the chart and in `aria-valuetext`. The
 * pointer makes the quiet hover sound; a press makes the click.
 */
export function exploreBigNumbers(
  root: HTMLElement,
  numbers: readonly BigNumber[],
): () => void {
  const cleanups = numbers.map((number, index) => {
    const tile = findElement<HTMLElement>(root, `[data-tile="${index}"]`);
    const years = number.perYear;
    if (years.length === 0) return () => {};

    const chart = findElement<HTMLElement>(tile, '[data-role="chart"]');
    const readout = findElement<HTMLElement>(tile, '[data-role="readout"]');
    const columns = years.map((_, i) =>
      findElement<HTMLElement>(tile, `[data-year-col="${i}"]`),
    );
    const labels = years.map((_, i) =>
      findElement<HTMLElement>(tile, `[data-year-label="${i}"]`),
    );
    const peak = Math.max(1, ...years.map((entry) => entry.value));
    const last = years.length - 1;
    let current = last;

    const show = (picked: number | null) => {
      const entry = picked === null ? undefined : years[picked];
      readout.textContent = entry ? yearReading(number, entry) : BY_YEAR;
      columns.forEach((column, i) => {
        column.style.opacity = entry && i !== picked ? DIMMED : "";
      });
      // The picked year is always named, even where the labels thin out.
      labels.forEach((label, i) => {
        label.style.fontSize = i === picked ? "var(--yf)" : "";
      });
      if (entry && picked !== null) {
        current = picked;
        chart.setAttribute("aria-valuenow", String(picked));
        chart.setAttribute("aria-valuetext", yearReading(number, entry));
      }
    };
    const hover = (picked: number) => {
      const entry = years[picked];
      show(picked);
      interaction.hover((entry?.value ?? 0) / peak, `${number.key}-${picked}`);
    };

    const at = (event: PointerEvent) =>
      indexAtPointer(
        event.clientX,
        chart.getBoundingClientRect(),
        years.length,
      );
    const onPointerMove = (event: PointerEvent) => hover(at(event));
    const onPointerDown = (event: PointerEvent) => {
      hover(at(event));
      interaction.click();
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (document.activeElement !== chart) show(null);
      interaction.leave();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const next = indexAfterKey(event.key, current, years.length, {
        bigStep: 5,
      });
      if (next === null) return;
      // The arrows belong to the chart while it is focused, not to the scenes.
      event.preventDefault();
      event.stopPropagation();
      hover(next);
    };
    const onFocus = () => hover(current);
    const onBlur = () => show(null);

    chart.setAttribute("role", "slider");
    chart.setAttribute("aria-label", `${number.label} by year`);
    chart.setAttribute("aria-orientation", "horizontal");
    chart.setAttribute("aria-valuemin", "0");
    chart.setAttribute("aria-valuemax", String(last));
    chart.setAttribute("aria-valuenow", String(last));
    const lastEntry = years[last];
    if (lastEntry) {
      chart.setAttribute("aria-valuetext", yearReading(number, lastEntry));
    }
    chart.tabIndex = 0;
    chart.addEventListener("pointermove", onPointerMove);
    chart.addEventListener("pointerdown", onPointerDown);
    chart.addEventListener("pointerleave", onPointerLeave);
    chart.addEventListener("keydown", onKeyDown);
    chart.addEventListener("focus", onFocus);
    chart.addEventListener("blur", onBlur);

    return () => {
      chart.removeEventListener("pointermove", onPointerMove);
      chart.removeEventListener("pointerdown", onPointerDown);
      chart.removeEventListener("pointerleave", onPointerLeave);
      chart.removeEventListener("keydown", onKeyDown);
      chart.removeEventListener("focus", onFocus);
      chart.removeEventListener("blur", onBlur);
      show(null);
      for (const name of SLIDER_ATTRIBUTES) chart.removeAttribute(name);
      chart.removeAttribute("tabindex");
    };
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
