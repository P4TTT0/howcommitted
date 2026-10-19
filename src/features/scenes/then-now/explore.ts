import { findElement, indexAfterKey } from "@/features/sequencer/explore";
import { panelElements, writePanel, writeReading } from "./mount";
import type { ThenNowPlan } from "./plan";

/**
 * Explore phase: the year buttons come alive. Click, tap or Left/Right/Home/End
 * pick the "then" year; both sides and the summary line are rewritten at once
 * (instant DOM updates, no sound, no clock). The arrows are kept from the
 * scene navigation while a picker button is focused. The cleanup puts the
 * default comparison and the disabled buttons back.
 */
export function exploreThenNow(
  root: HTMLElement,
  plan: ThenNowPlan,
): () => void {
  const picker = findElement<HTMLElement>(root, '[data-role="picker"]');
  const summary = findElement<HTMLElement>(root, '[data-role="summary"]');
  const thenPanel = panelElements(root, "then");
  const nowPanel = panelElements(root, "now");
  const buttons = [...picker.querySelectorAll<HTMLButtonElement>("button")];

  const select = (year: number) => {
    const comparison = plan.compare(year);
    writePanel(thenPanel, comparison.earlier);
    writePanel(nowPanel, comparison.now);
    writeReading(root, comparison);
    summary.textContent = comparison.summary;
    for (const button of buttons) {
      const selected = Number(button.dataset.year) === year;
      button.dataset.selected = String(selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  };

  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-year]",
    );
    if (button) select(Number(button.dataset.year));
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

  for (const button of buttons) button.disabled = false;
  picker.addEventListener("click", onClick);
  picker.addEventListener("keydown", onKeyDown);

  return () => {
    picker.removeEventListener("click", onClick);
    picker.removeEventListener("keydown", onKeyDown);
    select(plan.defaultThen);
    for (const button of buttons) button.disabled = true;
  };
}
