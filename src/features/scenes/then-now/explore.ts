import { findElement, indexAfterKey } from "@/features/sequencer/explore";
import { interaction } from "@/playback/sound/interaction";
import { panelElements, writeAxis, writePanel, writeReading } from "./mount";
import {
  type Comparison,
  dayLevel,
  dayReading,
  READOUT_IDLE,
  type ThenNowPlan,
} from "./plan";

/**
 * Explore phase: the year buttons and the weekday groups come alive. Click,
 * tap or Left/Right/Home/End pick the "then" year; both sides, the axis and the
 * summary line are rewritten at once (instant DOM updates, no clock; each pick clicks).
 * Hovering, focusing or tapping a weekday group highlights it, dims the others
 * and fills the black readout; leaving the chart resets it. The arrows are kept
 * from the scene navigation while a picker button is focused. The cleanup puts
 * the default comparison and the disabled buttons back.
 */
export function exploreThenNow(
  root: HTMLElement,
  plan: ThenNowPlan,
): () => void {
  const picker = findElement<HTMLElement>(root, '[data-role="picker"]');
  const summary = findElement<HTMLElement>(root, '[data-role="summary"]');
  const days = findElement<HTMLElement>(root, '[data-role="weekdays"]');
  const readoutDay = findElement<HTMLElement>(
    root,
    '[data-role="readout-day"]',
  );
  const readoutDetail = findElement<HTMLElement>(
    root,
    '[data-role="readout-detail"]',
  );
  const thenPanel = panelElements(root, "then");
  const nowPanel = panelElements(root, "now");
  const buttons = [...picker.querySelectorAll<HTMLButtonElement>("button")];
  const groups = [...days.querySelectorAll<HTMLElement>("[data-day]")];
  const dayLabels = [...root.querySelectorAll<HTMLElement>("[data-day-label]")];

  const stepper = findElement<HTMLElement>(root, '[data-role="stepper"]');
  const stepButtons = [
    ...stepper.querySelectorAll<HTMLButtonElement>("button[data-step]"),
  ];

  let comparison: Comparison = plan.compare(plan.defaultThen);
  let year = plan.defaultThen;
  let active = -1;

  const syncStepper = (enabled: boolean) => {
    const at = plan.years.indexOf(year);
    for (const button of stepButtons) {
      const target = at + Number(button.dataset.step);
      button.disabled = !enabled || target < 0 || target >= plan.years.length;
    }
  };

  const showDay = (index: number) => {
    active = index;
    groups.forEach((group, i) => {
      group.dataset.state = index < 0 ? "rest" : i === index ? "active" : "dim";
    });
    dayLabels.forEach((label, i) => {
      label.dataset.state = i === index ? "active" : "rest";
    });
    const reading = index < 0 ? READOUT_IDLE : dayReading(comparison, index);
    readoutDay.textContent = reading.day;
    readoutDetail.textContent = reading.detail;
  };

  const select = (picked: number, enabled = true) => {
    year = picked;
    comparison = plan.compare(picked);
    writePanel(thenPanel, comparison.earlier, comparison.axisMax);
    writePanel(nowPanel, comparison.now, comparison.axisMax);
    writeAxis(root, comparison);
    writeReading(root, comparison);
    summary.textContent = comparison.summary;
    showDay(active);
    for (const button of buttons) {
      const selected = Number(button.dataset.year) === picked;
      button.dataset.selected = String(selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    syncStepper(enabled);
  };

  const onStep = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-step]",
    );
    if (!button) return;
    const target =
      plan.years[plan.years.indexOf(year) + Number(button.dataset.step)];
    if (target === undefined) return;
    interaction.click();
    select(target);
  };

  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-year]",
    );
    if (!button) return;
    interaction.click();
    select(Number(button.dataset.year));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (current < 0) return;
    const next = indexAfterKey(event.key, current, buttons.length, {
      bigStep: 5,
    });
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    const button = buttons[next];
    if (!button) return;
    button.focus();
    select(Number(button.dataset.year));
  };

  const onDay = (event: Event) => {
    const group = (event.target as Element).closest<HTMLElement>("[data-day]");
    if (!group) return;
    const day = Number(group.dataset.day);
    showDay(day);
    interaction.hover(dayLevel(comparison, day), `day-${day}`);
  };
  const onLeave = () => {
    showDay(-1);
    interaction.leave();
  };
  const onFocusOut = (event: FocusEvent) => {
    if (!days.contains(event.relatedTarget as Node | null)) showDay(-1);
  };

  for (const button of buttons) button.disabled = false;
  syncStepper(true);
  picker.addEventListener("click", onClick);
  picker.addEventListener("keydown", onKeyDown);
  stepper.addEventListener("click", onStep);
  days.addEventListener("mouseover", onDay);
  days.addEventListener("focusin", onDay);
  days.addEventListener("click", onDay);
  days.addEventListener("mouseleave", onLeave);
  days.addEventListener("focusout", onFocusOut);

  return () => {
    picker.removeEventListener("click", onClick);
    picker.removeEventListener("keydown", onKeyDown);
    stepper.removeEventListener("click", onStep);
    days.removeEventListener("mouseover", onDay);
    days.removeEventListener("focusin", onDay);
    days.removeEventListener("click", onDay);
    days.removeEventListener("mouseleave", onLeave);
    days.removeEventListener("focusout", onFocusOut);
    showDay(-1);
    select(plan.defaultThen, false);
    for (const button of buttons) button.disabled = true;
  };
}
