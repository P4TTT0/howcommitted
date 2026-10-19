import { findElement } from "@/features/sequencer/explore";
import { swatchClass } from "@/features/versus/palette";
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
  GRID_DESCRIPTION,
  type SharedDaysModel,
  type YearData,
} from "./plan";

const DEFAULT_DETAIL = "Select a day to see who showed up.";
/** Page Up/Down move about a month. */
const BIG_STEP_DAYS = 30;
/** Gap between a day and its tooltip, which includes the arrow. */
const TIP_GAP = 10;
const TIP_EDGE = 6;
const EMPTY_SWATCH = "bg-[#E4E1D8]";

/**
 * Explore phase: the year stepper comes alive and so does the grid. Hover,
 * press or drag over a square (a tap on touch), or focus the grid and use the
 * arrows (Left/Right a day, Up/Down a week, Page Up/Down about a month,
 * Home/End the ends), to read who contributed that day in a black tooltip with
 * an arrow. The tooltip is clamped inside the grid and flips below a day near
 * the top of the scene. Instant DOM updates: no timers, no sound, no clock of
 * its own. The arrows stay with the grid while it is focused. The cleanup puts
 * the opening year back and the controls to sleep.
 */
export function exploreSharedDays(
  root: HTMLElement,
  model: SharedDaysModel,
): () => void {
  const elements = findYearElements(root, model);
  const stepper = findElement<HTMLElement>(root, '[data-role="year-step"]');
  const stepButtons = [
    ...stepper.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const tip = findElement<HTMLElement>(root, '[data-role="tip"]');
  const tipTitle = findElement<HTMLElement>(root, '[data-role="tip-title"]');
  const tipWho = findElement<HTMLElement>(root, '[data-role="tip-who"]');
  const tipArrow = findElement<HTMLElement>(root, '[data-role="tip-arrow"]');
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

  /** The grid the viewer is on: the one that is on screen. */
  const visibleGrid = () =>
    elements.grids.find((grid) => grid.container.offsetParent !== null);

  const hideTip = () => {
    tip.hidden = true;
  };

  const placeTip = () => {
    const grid = visibleGrid();
    const picked = day === null ? undefined : year.days[day];
    const slot =
      grid && day !== null ? grid.slots[slotOfDay(grid, year, day)] : undefined;
    if (!grid || !picked || !slot) {
      hideTip();
      return;
    }
    tipTitle.textContent = readTitle();
    tipWho.replaceChildren(
      ...(picked.people.length === 0
        ? [tipRow("Nobody that day", EMPTY_SWATCH)]
        : picked.people.map((person) =>
            tipRow(`@${model.logins[person]}`, swatchClass(person)),
          )),
    );
    tip.hidden = false;

    const host = tip.offsetParent as HTMLElement | null;
    if (!host) return;
    const hostBox = host.getBoundingClientRect();
    const slotBox = slot.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const center = slotBox.left + slotBox.width / 2 - hostBox.left;
    const left = Math.min(
      Math.max(center - width / 2, 0),
      hostBox.width - width,
    );
    const rootTop = root.getBoundingClientRect().top;
    const above = slotBox.top - height - TIP_GAP >= rootTop + TIP_EDGE;
    const top = above
      ? slotBox.top - hostBox.top - height - TIP_GAP
      : slotBox.bottom - hostBox.top + TIP_GAP;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    const arrow = Math.min(Math.max(center - left, 14), width - 14);
    tipArrow.style.left = `${arrow - 6}px`;
    tipArrow.style.top = above ? "" : "-6px";
    tipArrow.style.bottom = above ? "-6px" : "";
  };

  const showDay = () => {
    for (const grid of elements.grids) {
      for (const slot of grid.slots) slot.removeAttribute("data-selected");
      if (day === null) continue;
      const slot = grid.slots[slotOfDay(grid, year, day)];
      if (slot) slot.dataset.selected = "true";
    }
    updateAria();
    placeTip();
  };

  const showYear = (value: number) => {
    year = model.yearData(value);
    day = null;
    paintYear(elements, year, people);
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
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") select(null);
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
    container.setAttribute("aria-description", GRID_DESCRIPTION);
    container.tabIndex = 0;
    container.addEventListener("pointerdown", onPointer);
    container.addEventListener("pointermove", onPointer);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("keydown", onKeyDown);
    cleanups.push(() => {
      container.removeEventListener("pointerdown", onPointer);
      container.removeEventListener("pointermove", onPointer);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("keydown", onKeyDown);
      container.setAttribute("role", "img");
      if (originalLabel) container.setAttribute("aria-label", originalLabel);
      for (const name of [
        "aria-orientation",
        "aria-valuemin",
        "aria-valuemax",
        "aria-valuenow",
        "aria-valuetext",
        "aria-description",
      ]) {
        container.removeAttribute(name);
      }
      container.removeAttribute("tabindex");
    });
  }

  const onStepClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-step]",
    );
    if (!button) return;
    const next =
      model.years[model.years.indexOf(year.year) + Number(button.dataset.step)];
    if (next !== undefined) showYear(next);
  };

  stepper.addEventListener("click", onStepClick);
  showYear(year.year);

  return () => {
    stepper.removeEventListener("click", onStepClick);
    for (const cleanup of cleanups) cleanup();
    showYear(model.defaultYear);
    hideTip();
    for (const button of stepButtons) button.disabled = true;
  };
}

/** One line of the tooltip: a color square and a name. */
function tipRow(name: string, swatch: string): HTMLElement {
  const row = document.createElement("li");
  row.className = "flex min-w-0 items-center gap-1.5";
  const square = document.createElement("span");
  square.className = `size-2.5 shrink-0 ${swatch}`;
  square.setAttribute("aria-hidden", "true");
  row.append(square, name);
  return row;
}
