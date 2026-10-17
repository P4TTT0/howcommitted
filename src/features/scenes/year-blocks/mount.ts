import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import { activeBarIndex, riseProgress, type YearBar } from "./bars";

function find<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing scene element: ${selector}`);
  return element;
}

/**
 * Wires the year blocks to the sequencer's clock. Each block's rise is a pure
 * function of clock time, written per frame only when it changes; each tick is
 * scheduled on the Transport. No timers of its own.
 */
export function mountYearBlocks(
  root: HTMLElement,
  bars: readonly YearBar[],
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const columns = bars.map((_, index) =>
    find<HTMLElement>(root, `[data-bar="${index}"]`),
  );
  const readout = find<HTMLElement>(root, '[data-role="readout"]');
  const yearText = find<HTMLElement>(readout, '[data-role="year"]');
  const valueText = find<HTMLElement>(readout, '[data-role="value"]');

  bars.forEach((bar, index) => {
    const isLast = index === bars.length - 1;
    clock.at(bar.time, (time) => {
      const engine = sound();
      engine?.playTick({
        time,
        semitones: semitonesForDegree(bar.degree),
        intensity: 0.4 + 0.6 * bar.ratio,
      });
      if (isLast) engine?.playAccent(time);
    });
  });

  const scales = bars.map(() => Number.NaN);
  let shown = -1;
  let shownValue = Number.NaN;

  const render = (seconds: number) => {
    bars.forEach((bar, index) => {
      const progress = riseProgress(bar, seconds, reducedMotion);
      if (progress === scales[index]) return;
      scales[index] = progress;
      const column = columns[index];
      if (column) column.style.transform = `scaleY(${progress})`;
    });

    const active = activeBarIndex(bars, seconds);
    const bar = bars[active];
    if (!bar) return;
    if (active !== shown) {
      shown = active;
      const colors = blockForYearIndex(bar.colorIndex);
      readout.style.backgroundColor = colors.background;
      readout.style.color = colors.foreground;
      yearText.textContent = String(bar.year);
    }
    const value = Math.round(
      bar.contributions * riseProgress(bar, seconds, reducedMotion),
    );
    if (value !== shownValue) {
      shownValue = value;
      valueText.textContent = formatCount(value);
    }
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  return clock.onFrame(render);
}
