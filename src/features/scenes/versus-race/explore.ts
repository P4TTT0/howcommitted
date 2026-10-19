import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import { dayReading, type Race, type Races, valuesAtIndex } from "./race";
import { createReadout } from "./readout";

/** Left/Right move a week at a time: a day is too small a step over years. */
const KEY_STEP_DAYS = 7;
/** Page Up/Down move a year. */
const KEY_BIG_STEP_DAYS = 365;

/**
 * Explore phase of the race: the finished race can be read at any date, on
 * either time axis. The toggle between calendar years and same age comes
 * alive; pointer (mouse hover, touch press and drag) or keyboard (the chart
 * is one slider: Left/Right a week, Page Up/Down a year, Home/End the ends)
 * picks a day; the bars, their order, the year, date, crossings and every
 * exact value follow it. Instant DOM updates: no timers, no sound, no clock of
 * its own. The cleanup puts the calendar axis and the finished race back.
 */
export function exploreVersusRace(root: HTMLElement, races: Races): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const group = findElement<HTMLElement>(root, '[data-role="modes"]');
  const readout = createReadout(root, races.calendar);
  const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
  let race: Race = races.calendar;
  let current = race.length - 1;

  /** `null` shows the finished race again. */
  const show = (picked: number | null) => {
    const last = race.length - 1;
    const index = picked ?? last;
    readout.show(
      valuesAtIndex(race, index),
      index,
      (index + 0.5) / race.length,
    );
    if (picked !== null) current = picked;
    scrub.setAttribute("aria-valuemax", String(last));
    scrub.setAttribute("aria-valuenow", String(index));
    scrub.setAttribute("aria-valuetext", dayReading(race, index));
  };

  const choose = (mode: Race["mode"]) => {
    race = mode === "age" ? races.age : races.calendar;
    readout.setRace(race);
    current = race.length - 1;
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    }
    show(null);
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

  const onModeClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-mode]",
    );
    if (button) choose(button.dataset.mode === "age" ? "age" : "calendar");
  };
  const onModeKeyDown = (event: KeyboardEvent) => {
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next = indexAfterKey(event.key, at, buttons.length);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    const button = buttons[next];
    if (!button) return;
    button.focus();
    choose(button.dataset.mode === "age" ? "age" : "calendar");
  };

  scrub.hidden = false;
  scrub.tabIndex = 0;
  scrub.addEventListener("pointermove", pick);
  scrub.addEventListener("pointerdown", pick);
  scrub.addEventListener("pointerleave", onPointerLeave);
  scrub.addEventListener("keydown", onKeyDown);
  scrub.addEventListener("focus", onFocus);
  scrub.addEventListener("blur", onBlur);
  for (const button of buttons) button.disabled = false;
  group.addEventListener("click", onModeClick);
  group.addEventListener("keydown", onModeKeyDown);

  return () => {
    scrub.removeEventListener("pointermove", pick);
    scrub.removeEventListener("pointerdown", pick);
    scrub.removeEventListener("pointerleave", onPointerLeave);
    scrub.removeEventListener("keydown", onKeyDown);
    scrub.removeEventListener("focus", onFocus);
    scrub.removeEventListener("blur", onBlur);
    group.removeEventListener("click", onModeClick);
    group.removeEventListener("keydown", onModeKeyDown);
    choose("calendar");
    for (const button of buttons) button.disabled = true;
    scrub.tabIndex = -1;
    scrub.hidden = true;
  };
}
