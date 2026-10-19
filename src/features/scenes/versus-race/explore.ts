import { findElement, indexAfterKey } from "@/features/sequencer/explore";
import { interaction } from "@/playback/sound/interaction";
import { dayReading, type Race, valuesAtIndex, yearStartIndex } from "./race";
import { createReadout } from "./readout";

/** Left/Right move a week at a time: a day is too small a step over years. */
const KEY_STEP_DAYS = 7;
/** Page Up/Down move a year. */
const KEY_BIG_STEP_DAYS = 365;
/** A still reading announces a pass only for this many days after it. */
const EXPLORE_PASS_DAYS = 14;

/**
 * Explore phase of the race: the finished race can be read at any date.
 * The years of the timeline become buttons that jump to the first day of a
 * year; the chart is also one slider for the keyboard (Left/Right a week,
 * Page Up/Down a year, Home/End the ends). The bars, their places, the year,
 * the passes and every exact value follow. No timers and no clock of its
 * own; only a click on the year buttons sounds, through the interaction channel: rows slide with CSS, or jump under `prefers-reduced-motion`. The
 * cleanup puts the finished race back.
 */
export function exploreVersusRace(root: HTMLElement, race: Race): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const group = findElement<HTMLElement>(root, '[data-role="years"]');
  const readout = createReadout(root, race, EXPLORE_PASS_DAYS);
  const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
  const last = race.length - 1;
  let current = last;

  /** `null` shows the finished race again. */
  const show = (picked: number | null) => {
    const index = picked ?? last;
    readout.show(valuesAtIndex(race, index), index);
    if (picked !== null) current = picked;
    scrub.setAttribute("aria-valuenow", String(index));
    scrub.setAttribute("aria-valuetext", dayReading(race, index));
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
  const onYearClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-year]",
    );
    if (!button) return;
    interaction.click();
    show(yearStartIndex(race, Number(button.dataset.year)));
  };

  scrub.hidden = false;
  scrub.tabIndex = 0;
  scrub.addEventListener("keydown", onKeyDown);
  scrub.addEventListener("focus", onFocus);
  scrub.addEventListener("blur", onBlur);
  for (const button of buttons) button.disabled = false;
  group.addEventListener("click", onYearClick);

  return () => {
    scrub.removeEventListener("keydown", onKeyDown);
    scrub.removeEventListener("focus", onFocus);
    scrub.removeEventListener("blur", onBlur);
    group.removeEventListener("click", onYearClick);
    current = last;
    show(null);
    for (const button of buttons) button.disabled = true;
    scrub.tabIndex = -1;
    scrub.hidden = true;
  };
}
