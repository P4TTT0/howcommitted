import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import type { SceneRuntime } from "@/features/sequencer/types";
import { type BigNumber, countAt, countSounds } from "./numbers";

/**
 * Wires the four numbers to the sequencer's clock. Each count is a pure
 * function of clock time, written per frame only when it changes; its sound is
 * scheduled with it: rising ticks matching the displayed value, then one
 * closing hit when it settles. No timers of its own.
 */
export function mountBigNumbers(
  root: HTMLElement,
  numbers: readonly BigNumber[],
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const counters = numbers.map((_, index) =>
    findElement<HTMLElement>(
      root,
      `[data-tile="${index}"] [data-role="count"]`,
    ),
  );

  numbers.forEach((number) => {
    for (const { time: at, progress } of countSounds(number, reducedMotion)) {
      clock.at(at, (time) => sound()?.countTick(time, progress));
    }
    // With reduced motion the value appears at once: close when it does.
    const closeAt = reducedMotion ? number.start : number.land;
    clock.at(closeAt, (time) => sound()?.countClose(time));
  });

  const shown = numbers.map(() => Number.NaN);
  const render = (seconds: number) => {
    numbers.forEach((number, index) => {
      const value = countAt(number, seconds, reducedMotion);
      if (value === shown[index]) return;
      shown[index] = value;
      const counter = counters[index];
      if (counter) counter.textContent = formatCount(value);
    });
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  return clock.onFrame(render);
}
