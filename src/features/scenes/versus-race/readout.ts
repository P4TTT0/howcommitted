import { crossingCount } from "@/domain/crossings";
import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import {
  activePass,
  laneOrder,
  MAX_TICKS,
  niceTicks,
  passesLabel,
  type Race,
  scaleFor,
  yearAtIndex,
} from "./race";

const DOT_BASE = "size-3 shrink-0 rounded-full md:size-3.5";

export type Readout = {
  /**
   * Paints the race at one moment: every lane's value, bar and place, the
   * gridlines, the big year, the timeline, the passes so far and the pass
   * being announced. Plain DOM writes only, so the clock's frame loop and the
   * explore keys share it. Rows keep their nodes and only change place, so
   * CSS can slide them (and `prefers-reduced-motion` makes them jump).
   */
  show(values: readonly number[], index: number): void;
};

/**
 * Throws when the view is missing a part, so a broken scene is dropped.
 * `passDays` is how many days after a crossing it is still announced.
 */
export function createReadout(
  root: HTMLElement,
  race: Race,
  passDays: number,
): Readout {
  const lanes = race.lanes.map((_, lane) => ({
    row: findElement<HTMLElement>(root, `[data-lane="${lane}"]`),
    bar: findElement<HTMLElement>(root, `[data-lane-bar="${lane}"]`),
    value: findElement<HTMLElement>(root, `[data-lane-value="${lane}"]`),
    tip: findElement<HTMLElement>(root, `[data-lane-tip-value="${lane}"]`),
  }));
  const ticks = Array.from({ length: MAX_TICKS }, (_, slot) => {
    const tick = findElement<HTMLElement>(root, `[data-tick="${slot}"]`);
    return {
      tick,
      label: findElement<HTMLElement>(tick, '[data-part="label"]'),
    };
  });
  const year = findElement<HTMLElement>(root, '[data-role="year"]');
  const passes = findElement<HTMLElement>(root, '[data-role="passes"]');
  const chip = findElement<HTMLElement>(root, '[data-role="pass"]');
  const chipDot = findElement<HTMLElement>(chip, '[data-part="dot"]');
  const chipText = findElement<HTMLElement>(chip, '[data-part="text"]');
  const cells = [
    ...findElement<HTMLElement>(
      root,
      '[data-role="years"]',
    ).querySelectorAll<HTMLElement>("[data-year]"),
  ].map((cell) => ({
    year: Number(cell.dataset.year),
    bar: findElement<HTMLElement>(cell, '[data-part="bar"]'),
    label: findElement<HTMLElement>(cell, '[data-part="label"]'),
  }));

  // A picture that fails to load gives way to the initial under it.
  for (const image of root.querySelectorAll<HTMLImageElement>(
    "img[data-avatar]",
  )) {
    const hide = () => {
      image.hidden = true;
    };
    if (image.complete && image.naturalWidth === 0) hide();
    else image.addEventListener("error", hide, { once: true });
  }

  const lastValues: number[] = race.lanes.map(() => Number.NaN);
  let lastRanks = "";
  let lastYear = -1;
  let lastPasses = -1;
  let lastPass = "";

  return {
    show(values, index) {
      const scale = scaleFor(values);

      lanes.forEach(({ row, value, tip }, lane) => {
        const raw = values[lane] ?? 0;
        row.style.setProperty("--x", (raw / scale).toFixed(4));
        const rounded = Math.round(raw);
        if (rounded === lastValues[lane]) return;
        lastValues[lane] = rounded;
        const text = formatCount(rounded);
        value.textContent = text;
        tip.textContent = text;
      });

      const order = laneOrder(values.map((value) => Math.round(value)));
      const ranks = order.join(",");
      if (ranks !== lastRanks) {
        lastRanks = ranks;
        order.forEach((lane, rank) => {
          const row = lanes[lane]?.row;
          if (!row) return;
          row.style.transform = `translateY(${rank * 100}%)`;
          row.dataset.rank = String(rank);
        });
      }

      const shown = niceTicks(scale);
      ticks.forEach(({ tick, label }, slot) => {
        const mark = shown[slot];
        tick.hidden = !mark;
        if (!mark) return;
        tick.style.left = `${mark.x * 100}%`;
        if (label.textContent !== mark.label) label.textContent = mark.label;
      });

      const currentYear = yearAtIndex(race, index);
      if (currentYear !== lastYear) {
        lastYear = currentYear;
        year.textContent = String(currentYear);
        for (const cell of cells) {
          cell.bar.style.opacity = cell.year <= currentYear ? "1" : "0.18";
          cell.label.style.fontWeight = cell.year === currentYear ? "700" : "";
        }
      }

      const crossed = crossingCount(race.crossings, index);
      if (crossed !== lastPasses) {
        lastPasses = crossed;
        passes.textContent = passesLabel(crossed);
      }

      const pass = activePass(race, index, passDays);
      const passKey = pass ? `${pass.passer}>${pass.passed}` : "";
      if (passKey !== lastPass) {
        lastPass = passKey;
        chip.hidden = !pass;
        lanes.forEach(({ bar }, lane) => {
          bar.toggleAttribute("data-passing", pass?.passer === lane);
        });
        if (pass) {
          const passer = race.lanes[pass.passer]?.login ?? "";
          const passed = race.lanes[pass.passed]?.login ?? "";
          chipDot.className = `${DOT_BASE} ${swatchClass(pass.passer)}`;
          chipText.textContent = `@${passer} passes @${passed}`;
        }
      }
    },
  };
}
