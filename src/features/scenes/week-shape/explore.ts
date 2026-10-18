import {
  findElement,
  indexAfterKey,
  indexAtPointer,
} from "@/features/sequencer/explore";
import { barDetail, barReading, type WeekPlan } from "./plan";

const SLIDER_ATTRIBUTES = [
  "role",
  "aria-label",
  "aria-orientation",
  "aria-valuemin",
  "aria-valuemax",
  "aria-valuenow",
  "aria-valuetext",
];

const IDLE_TEXT = "Contributions by day of the week";

/**
 * Explore phase: the seven bars become one focusable slider over the days.
 * Left/Right and Home/End (or the pointer across the bars) pick a day; the
 * readout shows it and `aria-valuetext` speaks it. Nothing moves or sounds.
 */
export function exploreWeekShape(
  root: HTMLElement,
  plan: WeekPlan,
): () => void {
  const chart = findElement<HTMLElement>(root, '[data-role="bars"]');
  const readout = findElement<HTMLElement>(root, '[data-role="readout"]');
  const title = findElement<HTMLElement>(
    readout,
    '[data-role="readout-title"]',
  );
  const detail = findElement<HTMLElement>(
    readout,
    '[data-role="readout-detail"]',
  );
  const slots = plan.bars.map((bar) =>
    findElement<HTMLElement>(root, `[data-bar-slot="${bar.index}"]`),
  );
  const last = plan.bars.length - 1;
  let current = plan.bars.reduce(
    (best, bar) =>
      bar.value > (plan.bars[best]?.value ?? 0) ? bar.index : best,
    0,
  );

  const clearRing = () => {
    for (const slot of slots) slot.style.outline = "";
  };
  const show = (picked: number | null) => {
    clearRing();
    const bar = picked === null ? undefined : plan.bars[picked];
    if (picked === null || !bar) {
      readout.classList.add("invisible");
      chart.setAttribute("aria-valuetext", IDLE_TEXT);
      return;
    }
    current = picked;
    readout.classList.remove("invisible");
    title.textContent = bar.name;
    detail.textContent = barDetail(bar);
    const slot = slots[picked];
    if (slot) slot.style.outline = "3px solid var(--color-ink)";
    chart.setAttribute("aria-valuenow", String(picked));
    chart.setAttribute("aria-valuetext", barReading(bar));
  };

  const pick = (event: PointerEvent) =>
    show(
      indexAtPointer(
        event.clientX,
        chart.getBoundingClientRect(),
        plan.bars.length,
      ),
    );
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && document.activeElement !== chart) {
      show(null);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = indexAfterKey(event.key, current, plan.bars.length);
    if (next === null) return;
    // The arrows belong to the chart while it is focused, not to the scenes.
    event.preventDefault();
    event.stopPropagation();
    show(next);
  };
  const onFocus = () => show(current);
  const onBlur = () => show(null);

  chart.setAttribute("role", "slider");
  chart.setAttribute("aria-label", IDLE_TEXT);
  chart.setAttribute("aria-orientation", "horizontal");
  chart.setAttribute("aria-valuemin", "0");
  chart.setAttribute("aria-valuemax", String(last));
  chart.setAttribute("aria-valuenow", String(current));
  chart.setAttribute("aria-valuetext", IDLE_TEXT);
  chart.tabIndex = 0;
  chart.addEventListener("pointermove", pick);
  chart.addEventListener("pointerdown", pick);
  chart.addEventListener("pointerleave", onPointerLeave);
  chart.addEventListener("keydown", onKeyDown);
  chart.addEventListener("focus", onFocus);
  chart.addEventListener("blur", onBlur);

  return () => {
    chart.removeEventListener("pointermove", pick);
    chart.removeEventListener("pointerdown", pick);
    chart.removeEventListener("pointerleave", onPointerLeave);
    chart.removeEventListener("keydown", onKeyDown);
    chart.removeEventListener("focus", onFocus);
    chart.removeEventListener("blur", onBlur);
    clearRing();
    readout.classList.add("invisible");
    for (const name of SLIDER_ATTRIBUTES) chart.removeAttribute(name);
    chart.removeAttribute("tabindex");
  };
}
