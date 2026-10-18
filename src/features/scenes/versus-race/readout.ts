import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import { dateAtIndex, type Race, yearAtIndex } from "./race";

export type Readout = {
  /**
   * Paints the race at one moment: every lane's value, the shared year and
   * date, and the playhead (`position` 0..1 along the axis). Instant DOM
   * writes only, so the clock's frame loop and the explore pointer share it.
   */
  show(values: readonly number[], index: number, position: number): void;
};

/** Throws when the view is missing a part, so a broken scene is dropped. */
export function createReadout(root: HTMLElement, race: Race): Readout {
  const bars = race.lanes.map((_, lane) =>
    findElement<HTMLElement>(root, `[data-lane-bar="${lane}"]`),
  );
  const texts = race.lanes.map((_, lane) =>
    findElement<HTMLElement>(root, `[data-lane-value="${lane}"]`),
  );
  const year = findElement<HTMLElement>(root, '[data-role="year"]');
  const date = findElement<HTMLElement>(root, '[data-role="date"]');
  const playhead = findElement<HTMLElement>(root, '[data-role="playhead"]');
  const lastValues = race.lanes.map(() => Number.NaN);
  let lastIndex = -1;

  return {
    show(values, index, position) {
      race.lanes.forEach((_, lane) => {
        const value = Math.round(values[lane] ?? 0);
        if (value === lastValues[lane]) return;
        lastValues[lane] = value;
        const bar = bars[lane];
        const text = texts[lane];
        if (bar) bar.style.width = `${(value / race.peak) * 100}%`;
        if (text) text.textContent = formatCount(value);
      });
      if (index !== lastIndex) {
        lastIndex = index;
        year.textContent = String(yearAtIndex(race, index));
        date.textContent = dateAtIndex(race, index);
      }
      playhead.style.left = `${position * 100}%`;
    },
  };
}
