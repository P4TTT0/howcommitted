import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import type { Plan } from "@/features/sequencer/model/plan";
import { topPercent } from "./chart";
import {
  dayReading,
  type FlagMark,
  flagWindow,
  formatDay,
  nearFlags,
} from "./scrub";

/** Left/Right move a week at a time: a day is too small a step over years. */
const KEY_STEP_DAYS = 7;
/** Page Up/Down move a year. */
const KEY_BIG_STEP_DAYS = 365;

const HIDDEN_CLIP = "inset(0% 100% 0% 0%)";
const SHOWN_CLIP = "inset(0% 0% 0% 0%)";

/**
 * Explore phase of the cumulative line: the finished line can be read at any
 * day. Pointer (mouse hover, touch press and drag) or keyboard (the chart is
 * one slider: Left/Right a week, Page Up/Down a year, Home/End the ends) picks
 * a day. A cursor marks it, the block above shows that day's year and running
 * total, a chip gives the date, and repo-creation flags near it are labelled.
 * The "+N not attributed to a day" steps stay labelled, and a step's day says
 * so in its reading. Everything is an instant DOM update: no timers, no sound,
 * nothing animated on a clock of its own.
 */
export function exploreCumulativeLine(
  root: HTMLElement,
  plan: Plan,
  marks: readonly FlagMark[],
): () => void {
  const scrub = findElement<HTMLElement>(root, '[data-role="scrub"]');
  const cursor = findElement<HTMLElement>(root, '[data-role="cursor"]');
  const line = findElement<HTMLElement>(cursor, "[data-cursor-line]");
  const dot = findElement<HTMLElement>(cursor, "[data-cursor-dot]");
  const chip = findElement<HTMLElement>(cursor, "[data-cursor-chip]");
  const chipDate = findElement<HTMLElement>(chip, "[data-chip-date]");
  const chipTotal = findElement<HTMLElement>(chip, "[data-chip-total]");
  const layers = [...root.querySelectorAll<HTMLElement>("[data-year-layer]")];
  const totals = [...root.querySelectorAll<HTMLElement>('[data-role="total"]')];
  const labels = [...root.querySelectorAll<HTMLElement>("[data-flag-label]")];

  const count = plan.days.length;
  const last = count - 1;
  const reach = flagWindow(count);
  const yearIndexOfDay = (index: number) => {
    const year = Number(plan.days[index]?.date.slice(0, 4));
    return Math.max(
      0,
      plan.years.findIndex((span) => span.year === year),
    );
  };
  let current = last;

  /** `null` shows the finished scene again. */
  const show = (picked: number | null) => {
    const index = picked ?? last;
    const total = plan.cumulative[index] ?? 0;
    const date = plan.days[index]?.date ?? "";

    // The block above follows the day: its year, and the running total.
    const shownYear = yearIndexOfDay(index);
    layers.forEach((layer, at) => {
      layer.style.clipPath = at <= shownYear ? SHOWN_CLIP : HIDDEN_CLIP;
    });
    const text = formatCount(total);
    for (const element of totals) element.textContent = text;

    const near = picked === null ? [] : nearFlags(marks, index, reach);
    labels.forEach((label, at) => {
      const mark = marks[at];
      label.dataset.visible = String(Boolean(mark && near.includes(mark)));
    });

    cursor.hidden = picked === null;
    if (picked === null) return;

    current = picked;
    const x = (((index + 1) / count) * 100).toFixed(3);
    line.style.left = `${x}%`;
    dot.style.left = `${x}%`;
    dot.style.top = `${topPercent(plan, total)}%`;
    chip.style.left = `${x}%`;
    chip.style.transform = Number(x) > 55 ? "translateX(-100%)" : "";
    chipDate.textContent = formatDay(date);
    chipTotal.textContent = `${text} contributions so far`;
    scrub.setAttribute("aria-valuenow", String(index));
    scrub.setAttribute(
      "aria-valuetext",
      dayReading({
        date,
        total,
        step: plan.steps.find(
          (step) => Math.abs(step.dayIndex - index) <= reach,
        ),
        flags: near,
      }),
    );
  };

  const pick = (event: PointerEvent) =>
    show(indexAtPointer(event.clientX, scrub.getBoundingClientRect(), count));
  const onPointerLeave = (event: PointerEvent) => {
    // A finger lifting is not the pointer leaving: the reading stays.
    if (event.pointerType === "mouse") show(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = indexAfterKey(event.key, current, count, {
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
