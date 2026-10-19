import { crossingCount, crossingsUpTo } from "@/domain/crossings";
import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import {
  axisLabels,
  dateLabel,
  laneOrder,
  notThereYet,
  type Race,
  whenLabel,
  yearLabel,
} from "./race";

/** How many of the latest crossings the readout names. */
export const CROSSING_SLOTS = 3;

/** The subtitle under the headline, per time axis. */
export const SUBTITLES = {
  calendar:
    "Running total of contributions. The bars swap places as the years go by.",
  age: "Everyone starts at their own first year with a contribution.",
} as const;

const DOT_BASE = "size-2.5 shrink-0 rounded-full";

export type Readout = {
  /**
   * Switches the readout to another axis of the same lanes: the axis labels,
   * the subtitle and the toggle. Call `show` afterwards.
   */
  setRace(race: Race): void;
  /**
   * Paints the race at one moment: every lane's value and position, the big
   * label, the date, the playhead (`position` 0..1 along the axis) and the
   * crossings so far. Instant DOM writes only, so the clock's frame loop and
   * the explore pointer share it.
   */
  show(values: readonly number[], index: number, position: number): void;
};

/** Throws when the view is missing a part, so a broken scene is dropped. */
export function createReadout(root: HTMLElement, initial: Race): Readout {
  let race = initial;
  const list = findElement<HTMLElement>(root, '[data-role="lanes"]');
  const items = race.lanes.map((_, lane) =>
    findElement<HTMLElement>(root, `[data-lane="${lane}"]`),
  );
  const bars = race.lanes.map((_, lane) =>
    findElement<HTMLElement>(root, `[data-lane-bar="${lane}"]`),
  );
  const texts = race.lanes.map((_, lane) =>
    findElement<HTMLElement>(root, `[data-lane-value="${lane}"]`),
  );
  const year = findElement<HTMLElement>(root, '[data-role="year"]');
  const date = findElement<HTMLElement>(root, '[data-role="date"]');
  const playhead = findElement<HTMLElement>(root, '[data-role="playhead"]');
  const marks = findElement<HTMLElement>(root, '[data-role="marks"]');
  const subtitle = findElement<HTMLElement>(root, '[data-role="subtitle"]');
  const count = findElement<HTMLElement>(root, '[data-role="crossing-count"]');
  const none = findElement<HTMLElement>(root, '[data-role="crossing-none"]');
  const chips = Array.from({ length: CROSSING_SLOTS }, (_, slot) => {
    const chip = findElement<HTMLElement>(root, `[data-crossing="${slot}"]`);
    return {
      chip,
      when: findElement<HTMLElement>(chip, '[data-part="when"]'),
      dot: findElement<HTMLElement>(chip, '[data-part="dot"]'),
      text: findElement<HTMLElement>(chip, '[data-part="text"]'),
    };
  });

  let lastValues: number[] = race.lanes.map(() => Number.NaN);
  let lastIndex = -1;
  let lastOrder = "";
  let lastCrossings = "";

  return {
    setRace(next) {
      race = next;
      lastValues = race.lanes.map(() => Number.NaN);
      lastIndex = -1;
      lastOrder = "";
      lastCrossings = "";
      subtitle.textContent = SUBTITLES[race.mode];
      marks.replaceChildren(
        ...axisLabels(race).map((mark) => {
          const label = document.createElement("span");
          label.className = "absolute top-1";
          label.style.left = `${mark.startProgress * 100}%`;
          label.textContent = mark.label;
          return label;
        }),
      );
    },
    show(values, index, position) {
      race.lanes.forEach((lane, laneIndex) => {
        const value = Math.round(values[laneIndex] ?? 0);
        const waiting = notThereYet(lane, index, value);
        // Encode both so a change of either repaints.
        const key = waiting ? -1 : value;
        if (key === lastValues[laneIndex]) return;
        lastValues[laneIndex] = key;
        const bar = bars[laneIndex];
        const text = texts[laneIndex];
        if (bar) bar.style.width = `${(value / race.peak) * 100}%`;
        if (text)
          text.textContent = waiting ? "Not there yet" : formatCount(value);
      });

      const order = laneOrder(values.map((value) => Math.round(value)));
      const orderKey = order.join(",");
      if (orderKey !== lastOrder) {
        lastOrder = orderKey;
        list.append(...order.flatMap((laneIndex) => items[laneIndex] ?? []));
      }

      if (index !== lastIndex) {
        lastIndex = index;
        year.textContent = yearLabel(race, index);
        date.textContent = dateLabel(race, index);
      }
      playhead.style.left = `${position * 100}%`;

      const crossed = crossingCount(race.crossings, index);
      const crossKey = `${race.mode}:${crossed}`;
      if (crossKey !== lastCrossings) {
        lastCrossings = crossKey;
        const latest = crossingsUpTo(race.crossings, index, CROSSING_SLOTS);
        count.textContent = crossed > 0 ? ` · ${formatCount(crossed)}` : "";
        none.hidden = latest.length > 0;
        chips.forEach(({ chip, when, dot, text }, slot) => {
          const crossing = latest[slot];
          chip.hidden = !crossing;
          if (!crossing) return;
          const passer = race.lanes[crossing.passer]?.login ?? "";
          const passed = race.lanes[crossing.passed]?.login ?? "";
          when.textContent = whenLabel(race, crossing.index);
          dot.className = `${DOT_BASE} ${swatchClass(crossing.passer)}`;
          text.textContent = `@${passer} passes @${passed}`;
        });
      }
    },
  };
}
