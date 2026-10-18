import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import { popAt, type RecordsPlan, stripFillAt } from "./plan";

/**
 * Wires the streak strip and the tiles to the sequencer's clock. The strip fill
 * and each tile's pop are pure functions of clock time; one chip lands with
 * each tile. No timers of its own.
 */
export function mountRecords(
  root: HTMLElement,
  plan: RecordsPlan,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const ticks = plan.ticks.map((_, index) =>
    findElement<HTMLElement>(root, `[data-tick="${index}"]`),
  );
  const tiles = plan.tiles.map((_, index) =>
    findElement<HTMLElement>(root, `[data-tile="${index}"]`),
  );

  clock.at(plan.stripStart, (time) => {
    sound()?.playTick({
      time,
      semitones: semitonesForDegree(0),
      intensity: 0.7,
    });
  });
  plan.tiles.forEach((tile, index) => {
    const isLast = index === plan.tiles.length - 1;
    clock.at(tile.start, (time) => {
      const engine = sound();
      engine?.playTick({
        time,
        semitones: semitonesForDegree(tile.degree),
        intensity: 0.7,
      });
      if (isLast) engine?.playAccent(time);
    });
  });

  let shownFill = Number.NaN;
  const shownTiles = plan.tiles.map(() => Number.NaN);
  const render = (seconds: number) => {
    const fill = stripFillAt(plan, seconds, reducedMotion);
    if (fill !== shownFill) {
      shownFill = fill;
      const filled = Math.round(fill * ticks.length);
      ticks.forEach((tick, index) => {
        tick.style.opacity = index < filled ? String(plan.ticks[index]) : "0";
      });
    }
    plan.tiles.forEach((tile, index) => {
      const pop = popAt(tile, seconds, reducedMotion);
      if (pop === shownTiles[index]) return;
      shownTiles[index] = pop;
      const element = tiles[index];
      if (!element) return;
      element.style.opacity = String(pop);
      element.style.transform = pop >= 1 ? "" : `scale(${0.92 + 0.08 * pop})`;
    });
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  return clock.onFrame(render);
}
