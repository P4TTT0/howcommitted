import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import {
  everyoneLabel,
  MONTH_BLOCK,
  type SharedDaysModel,
  WEEK_COLUMNS,
  type YearData,
} from "./plan";

/** One of the two layouts of the same days (week strip or month blocks). */
export type Grid = {
  kind: "weeks" | "months";
  container: HTMLElement;
  slots: HTMLElement[];
  /** Per slot, the colored parts in developer order. */
  parts: HTMLElement[][];
  /** Slots per reveal group: a week of 7, or a month block. */
  groupSize: number;
};

const GROUP_SIZE = { weeks: 7, months: MONTH_BLOCK } as const;

function gridOf(root: HTMLElement, kind: Grid["kind"]): Grid {
  const container = findElement<HTMLElement>(
    root,
    `[data-role="grid-${kind}"]`,
  );
  const slots = [...container.querySelectorAll<HTMLElement>("[data-slot]")];
  return {
    kind,
    container,
    slots,
    parts: slots.map((slot) => [...slot.children] as HTMLElement[]),
    groupSize: GROUP_SIZE[kind],
  };
}

/** Both layouts, week strip first. Throws when the view is missing a part. */
export function findGrids(root: HTMLElement): [Grid, Grid] {
  return [gridOf(root, "weeks"), gridOf(root, "months")];
}

/** The day of a slot for the grid's layout, or null for an empty slot. */
export function daySlots(grid: Grid, year: YearData): (number | null)[] {
  return grid.kind === "weeks" ? year.weekSlots : year.monthSlots;
}

/** Slot of a day in a layout, or -1. */
export function slotOfDay(grid: Grid, year: YearData, day: number): number {
  return daySlots(grid, year).indexOf(day);
}

/** The parts of the markup that show one year, found once. */
export type YearElements = {
  grids: [Grid, Grid];
  legend: HTMLElement[];
  stats: { everyone: HTMLElement; anyone: HTMLElement; run: HTMLElement };
  everyoneLabel: HTMLElement;
  monthLabels: HTMLElement[];
  yearCurrent: HTMLElement;
};

export function findYearElements(
  root: HTMLElement,
  model: SharedDaysModel,
): YearElements {
  return {
    grids: findGrids(root),
    legend: model.logins.map((_, person) =>
      findElement<HTMLElement>(
        root,
        `[data-role="legend-days"][data-person="${person}"]`,
      ),
    ),
    stats: {
      everyone: findElement<HTMLElement>(root, '[data-stat="everyone"]'),
      anyone: findElement<HTMLElement>(root, '[data-stat="anyone"]'),
      run: findElement<HTMLElement>(root, '[data-stat="run"]'),
    },
    everyoneLabel: findElement<HTMLElement>(
      root,
      '[data-stat-label="everyone"]',
    ),
    monthLabels: Array.from({ length: 12 }, (_, month) =>
      findElement<HTMLElement>(root, `[data-month-label="${month}"]`),
    ),
    yearCurrent: findElement<HTMLElement>(root, '[data-role="year-current"]'),
  };
}

/** Repaints both layouts, the legend, the stats and the labels for a year. */
export function paintYear(
  elements: YearElements,
  year: YearData,
  people: number,
): void {
  for (const grid of elements.grids) {
    const days = daySlots(grid, year);
    grid.slots.forEach((slot, index) => {
      const day = days[index] ?? null;
      slot.classList.toggle("invisible", day === null);
      slot.removeAttribute("data-selected");
      const active = day === null ? [] : (year.days[day]?.people ?? []);
      grid.parts[index]?.forEach((part, person) => {
        part.hidden = !active.includes(person);
      });
    });
  }
  year.stats.perPerson.forEach((count, person) => {
    const element = elements.legend[person];
    if (element) element.textContent = formatCount(count);
  });
  elements.stats.everyone.textContent = formatCount(year.stats.everyone);
  elements.stats.anyone.textContent = formatCount(year.stats.anyone);
  elements.stats.run.textContent = formatCount(year.stats.longestRun);
  elements.everyoneLabel.textContent = everyoneLabel(people);
  year.monthColumns.forEach((column, month) => {
    const label = elements.monthLabels[month];
    if (label) label.style.left = `${(column / WEEK_COLUMNS) * 100}%`;
  });
  elements.yearCurrent.textContent = String(year.year);
}
