import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import { type BigNumber, totalReading, yearReading } from "./numbers";

const SLIDER_ATTRIBUTES = [
  "role",
  "aria-orientation",
  "aria-valuemin",
  "aria-valuemax",
  "aria-valuenow",
  "aria-valuetext",
];

/**
 * Explore phase: each finished number becomes one focusable slider over the
 * years. Left/Right, Page and Home/End (or the pointer across the block) pick a
 * year; the exact value is shown small under the number and spoken through
 * `aria-valuetext`. Nothing here moves, makes sound or keeps a clock.
 */
export function exploreBigNumbers(
  root: HTMLElement,
  numbers: readonly BigNumber[],
): () => void {
  const cleanups = numbers.map((number, index) => {
    const tile = findElement<HTMLElement>(root, `[data-tile="${index}"]`);
    const detail = findElement<HTMLElement>(tile, '[data-role="detail"]');
    const years = number.perYear;
    const last = years.length - 1;
    let current = last;

    const show = (picked: number | null) => {
      const entry = picked === null ? undefined : years[picked];
      if (picked === null || !entry) {
        detail.textContent = "";
        tile.setAttribute("aria-valuetext", totalReading(number));
        return;
      }
      current = picked;
      detail.textContent = `${entry.year}: ${formatCount(entry.value)}`;
      tile.setAttribute("aria-valuenow", String(picked));
      tile.setAttribute("aria-valuetext", yearReading(number, entry));
    };

    const pick = (event: PointerEvent) =>
      show(
        indexAtPointer(
          event.clientX,
          tile.getBoundingClientRect(),
          years.length,
        ),
      );
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") show(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const next = indexAfterKey(event.key, current, years.length, {
        bigStep: 5,
      });
      if (next === null) return;
      // The arrows belong to the number while it is focused, not to the scenes.
      event.preventDefault();
      event.stopPropagation();
      show(next);
    };
    const onFocus = () => show(current);
    const onBlur = () => show(null);

    if (years.length === 0) return () => {};

    const previousLabel = tile.getAttribute("aria-label");
    tile.setAttribute("role", "slider");
    tile.setAttribute("aria-label", number.label);
    tile.setAttribute("aria-orientation", "horizontal");
    tile.setAttribute("aria-valuemin", "0");
    tile.setAttribute("aria-valuemax", String(last));
    tile.setAttribute("aria-valuenow", String(last));
    tile.setAttribute("aria-valuetext", totalReading(number));
    tile.tabIndex = 0;
    tile.addEventListener("pointermove", pick);
    tile.addEventListener("pointerdown", pick);
    tile.addEventListener("pointerleave", onPointerLeave);
    tile.addEventListener("keydown", onKeyDown);
    tile.addEventListener("focus", onFocus);
    tile.addEventListener("blur", onBlur);

    return () => {
      tile.removeEventListener("pointermove", pick);
      tile.removeEventListener("pointerdown", pick);
      tile.removeEventListener("pointerleave", onPointerLeave);
      tile.removeEventListener("keydown", onKeyDown);
      tile.removeEventListener("focus", onFocus);
      tile.removeEventListener("blur", onBlur);
      detail.textContent = "";
      for (const name of SLIDER_ATTRIBUTES) tile.removeAttribute(name);
      if (previousLabel) tile.setAttribute("aria-label", previousLabel);
      tile.removeAttribute("tabindex");
    };
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
