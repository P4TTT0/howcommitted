import { findElement } from "@/features/sequencer/explore";
import {
  daySlots,
  findYearElements,
  type Grid,
  paintYear,
  slotOfDay,
} from "./paint";
import {
  dateTitle,
  dayDetail,
  type SharedDaysModel,
  type YearData,
} from "./plan";

const DEFAULT_DETAIL = "Select a day to see who showed up.";
/** Page Up/Down move about a month. */
const BIG_STEP_DAYS = 30;

/**
 * Explore phase: the year buttons come alive (chips on wide screens, a
 * stepper on phones) and so does the grid. Press, drag or hover a square, or
 * focus the grid and use the arrows (Left/Right a day, Up/Down a week, Page
 * Up/Down about a month, Home/End the ends), to read who contributed that
 * day in the black box. Instant DOM updates: no timers, no sound, no clock of
 * its own. The arrows stay with the grid while it is focused. The cleanup puts
 * the opening year back and the controls to sleep.
 */
export function exploreSharedDays(
  root: HTMLElement,
  model: SharedDaysModel,
): () => void {
  const elements = findYearElements(root, model);
  const chips = findElement<HTMLElement>(root, '[data-role="years"]');
  const stepper = findElement<HTMLElement>(root, '[data-role="year-step"]');
  const chipButtons = [...chips.querySelectorAll<HTMLButtonElement>("button")];
  const stepButtons = [
    ...stepper.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const people = model.logins.length;

  let year: YearData = model.yearData(model.defaultYear);
  let day: number | null = null;

  const readTitle = () =>
    day === null ? String(year.year) : dateTitle(year.days[day]?.date ?? "");
  const readDetail = () => {
    const picked = day === null ? undefined : year.days[day];
    return picked ? dayDetail(picked, model.logins) : DEFAULT_DETAIL;
  };

  const updateAria = () => {
    for (const grid of elements.grids) {
      grid.container.setAttribute(
        "aria-valuemax",
        String(year.days.length - 1),
      );
      grid.container.setAttribute("aria-valuenow", String(day ?? 0));
      grid.container.setAttribute(
        "aria-valuetext",
        day === null
          ? `${year.year}. ${DEFAULT_DETAIL}`
          : `${readTitle()}: ${readDetail()}`,
      );
    }
  };

  const showDay = () => {
    elements.title.textContent = readTitle();
    elements.detail.textContent = readDetail();
    for (const grid of elements.grids) {
      for (const slot of grid.slots) slot.removeAttribute("data-selected");
      if (day === null) continue;
      const slot = grid.slots[slotOfDay(grid, year, day)];
      if (slot) slot.dataset.selected = "true";
    }
    updateAria();
  };

  const showYear = (value: number) => {
    year = model.yearData(value);
    day = null;
    paintYear(elements, year, people);
    for (const button of chipButtons) {
      const selected = Number(button.dataset.year) === value;
      button.dataset.selected = String(selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    const at = model.years.indexOf(value);
    stepButtons.forEach((button) => {
      const direction = Number(button.dataset.step);
      button.disabled =
        at + direction < 0 || at + direction >= model.years.length;
    });
    showDay();
  };

  const select = (next: number | null) => {
    day =
      next === null ? null : Math.min(year.days.length - 1, Math.max(0, next));
    showDay();
  };

  const dayAt = (
    grid: Grid,
    clientX: number,
    clientY: number,
  ): number | null => {
    const element = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-slot]");
    if (!element || !grid.container.contains(element)) return null;
    return daySlots(grid, year)[Number(element.dataset.slot)] ?? null;
  };

  const cleanups: (() => void)[] = [];
  for (const grid of elements.grids) {
    const { container } = grid;
    const originalLabel = container.getAttribute("aria-label");
    const onPointer = (event: PointerEvent) => {
      // A mouse hovers; a finger or pen must press.
      if (
        event.type === "pointermove" &&
        event.pointerType !== "mouse" &&
        event.buttons === 0
      )
        return;
      const picked = dayAt(grid, event.clientX, event.clientY);
      if (picked !== null) select(picked);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const last = year.days.length - 1;
      const base = day ?? 0;
      let next: number | null = null;
      switch (event.key) {
        case "ArrowLeft":
          next = day === null ? 0 : base - 1;
          break;
        case "ArrowRight":
          next = day === null ? 0 : base + 1;
          break;
        case "ArrowUp":
          next = day === null ? 0 : base - 7;
          break;
        case "ArrowDown":
          next = day === null ? 0 : base + 7;
          break;
        case "PageUp":
          next = base - BIG_STEP_DAYS;
          break;
        case "PageDown":
          next = base + BIG_STEP_DAYS;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = last;
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
      select(next);
    };
    container.setAttribute("role", "slider");
    container.setAttribute("aria-label", "Days of the year, who contributed");
    container.setAttribute("aria-orientation", "horizontal");
    container.setAttribute("aria-valuemin", "0");
    container.tabIndex = 0;
    container.addEventListener("pointerdown", onPointer);
    container.addEventListener("pointermove", onPointer);
    container.addEventListener("keydown", onKeyDown);
    cleanups.push(() => {
      container.removeEventListener("pointerdown", onPointer);
      container.removeEventListener("pointermove", onPointer);
      container.removeEventListener("keydown", onKeyDown);
      container.setAttribute("role", "img");
      if (originalLabel) container.setAttribute("aria-label", originalLabel);
      for (const name of [
        "aria-orientation",
        "aria-valuemin",
        "aria-valuemax",
        "aria-valuenow",
        "aria-valuetext",
      ]) {
        container.removeAttribute(name);
      }
      container.removeAttribute("tabindex");
    });
  }

  const onChipClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-year]",
    );
    if (button) showYear(Number(button.dataset.year));
  };
  const onChipKeyDown = (event: KeyboardEvent) => {
    const at = chipButtons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const keys: Record<string, number> = {
      ArrowLeft: at - 1,
      ArrowRight: at + 1,
      Home: 0,
      End: chipButtons.length - 1,
    };
    const target = keys[event.key];
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const button =
      chipButtons[Math.min(chipButtons.length - 1, Math.max(0, target))];
    if (!button) return;
    button.focus();
    showYear(Number(button.dataset.year));
  };
  const onStepClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-step]",
    );
    if (!button) return;
    const next =
      model.years[model.years.indexOf(year.year) + Number(button.dataset.step)];
    if (next !== undefined) showYear(next);
  };

  for (const button of chipButtons) button.disabled = false;
  chips.addEventListener("click", onChipClick);
  chips.addEventListener("keydown", onChipKeyDown);
  stepper.addEventListener("click", onStepClick);
  showYear(year.year);

  return () => {
    chips.removeEventListener("click", onChipClick);
    chips.removeEventListener("keydown", onChipKeyDown);
    stepper.removeEventListener("click", onStepClick);
    for (const cleanup of cleanups) cleanup();
    showYear(model.defaultYear);
    for (const button of chipButtons) button.disabled = true;
    for (const button of stepButtons) button.disabled = true;
  };
}
