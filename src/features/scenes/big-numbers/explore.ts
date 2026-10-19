import { findElement } from "@/features/sequencer/explore";
import { interaction } from "@/playback/sound/interaction";
import { type BigNumber, BY_YEAR, yearReading } from "./numbers";

const DIMMED = "0.35";

/**
 * Explore phase: each year column of a number is already a real button. This
 * wires them: hovering, focusing or tapping one highlights it (the others dim)
 * and writes its reading in the line above the chart. The pointer makes the
 * quiet hover sound; a click or tap makes the click. Nothing moves or keeps a
 * clock.
 */
export function exploreBigNumbers(
  root: HTMLElement,
  numbers: readonly BigNumber[],
): () => void {
  const cleanups = numbers.map((number, index) => {
    const tile = findElement<HTMLElement>(root, `[data-tile="${index}"]`);
    const years = number.perYear;
    if (years.length === 0) return () => {};

    const readout = findElement<HTMLElement>(tile, '[data-role="readout"]');
    const columns = years.map((_, i) =>
      findElement<HTMLButtonElement>(tile, `[data-year-col="${i}"]`),
    );
    const peak = Math.max(1, ...years.map((entry) => entry.value));

    const show = (picked: number | null) => {
      const entry = picked === null ? undefined : years[picked];
      readout.textContent = entry ? yearReading(number, entry) : BY_YEAR;
      columns.forEach((column, i) => {
        column.style.opacity = entry && i !== picked ? DIMMED : "";
      });
    };

    const listeners = columns.map((column, i) => {
      const entry = years[i];
      const hover = () => {
        show(i);
        interaction.hover((entry?.value ?? 0) / peak, `${number.key}-${i}`);
      };
      const click = () => {
        show(i);
        interaction.click();
      };
      const onPointerLeave = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        if (document.activeElement !== column) show(null);
        interaction.leave();
      };
      const onBlur = () => show(null);
      // The arrows belong to the chart while a column is focused, not to the scenes.
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          const target = columns[i + (event.key === "ArrowLeft" ? -1 : 1)];
          target?.focus();
        }
      };

      column.addEventListener("pointerenter", hover);
      column.addEventListener("focus", hover);
      column.addEventListener("click", click);
      column.addEventListener("pointerleave", onPointerLeave);
      column.addEventListener("blur", onBlur);
      column.addEventListener("keydown", onKeyDown);
      return () => {
        column.removeEventListener("pointerenter", hover);
        column.removeEventListener("focus", hover);
        column.removeEventListener("click", click);
        column.removeEventListener("pointerleave", onPointerLeave);
        column.removeEventListener("blur", onBlur);
        column.removeEventListener("keydown", onKeyDown);
      };
    });

    return () => {
      for (const remove of listeners) remove();
      show(null);
    };
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
