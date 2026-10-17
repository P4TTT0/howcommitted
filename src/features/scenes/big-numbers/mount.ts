import { findElement } from "@/features/sequencer/explore";
import { formatCount } from "@/features/sequencer/model/format";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import { type BigNumber, countAt } from "./numbers";

/**
 * Wires the four numbers to the sequencer's clock. Each count is a pure
 * function of clock time, written per frame only when it changes; one soft cue
 * is scheduled as each number lands. No timers of its own.
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

  numbers.forEach((number, index) => {
    const isLast = index === numbers.length - 1;
    clock.at(number.land, (time) => {
      const engine = sound();
      engine?.playTick({
        time,
        semitones: semitonesForDegree(number.degree),
        intensity: 0.7,
      });
      if (isLast) engine?.playPayoff({ time, kind: "final" });
    });
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
