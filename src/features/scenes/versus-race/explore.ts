import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import { dayReading, type Race, valuesAtIndex } from "./race";
import { createReadout } from "./readout";

/** Left/Right move a week at a time: a day is too small a step over years. */
const KEY_STEP_DAYS = 7;
/** Page Up/Down move a year. */
const KEY_BIG_STEP_DAYS = 365;

/**
 * Explore phase of the race: the finished race can be read at any date.
 * Pointer (mouse hover, touch press and drag) or keyboard (the chart is one
 * slider: Left/Right a week, Page Up/Down a year, Home/End the ends) picks a
 * day; the bars, year, date and every exact value follow it. Instant DOM
 * updates: no timers, no sound, no clock of its own.
 */
export function exploreVersusRace(root: HTMLElement, race: Race): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const readout = createReadout(root, race);
  const last = race.length - 1;
  let current = last;

  /** `null` shows the finished race again. */
  const show = (picked: number | null) => {
    const index = picked ?? last;
    readout.show(
      valuesAtIndex(race, index),
      index,
      (index + 0.5) / race.length,
    );
    if (picked === null) return;
    current = picked;
    scrub.setAttribute("aria-valuenow", String(index));
    scrub.setAttribute("aria-valuetext", dayReading(race, index));
  };

  const pick = (event: PointerEvent) =>
    show(
      indexAtPointer(event.clientX, scrub.getBoundingClientRect(), race.length),
    );
  const onPointerLeave = (event: PointerEvent) => {
    // A finger lifting is not the pointer leaving: the reading stays.
    if (event.pointerType === "mouse") show(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = indexAfterKey(event.key, current, race.length, {
      step: KEY_STEP_DAYS,
      bigStep: KEY_BIG_STEP_DAYS,
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
