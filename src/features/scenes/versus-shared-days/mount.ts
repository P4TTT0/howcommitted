import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import { findGrids } from "./paint";
import { groupsShown, REVEAL_SECONDS, STATS_FADE_SECONDS } from "./plan";

/** One soft tick per month while the year appears. */
const TICKS = 12;

/**
 * Wires the scene to the sequencer's clock: the year appears week by week on
 * wide screens and month by month on phones, then the numbers fade in. Every
 * value is a pure function of clock time, written per frame only when it
 * changes. A tick per month and one accent when the numbers land; no timers
 * of its own. Returns the cleanup.
 */
export function mountSharedDays(
  root: HTMLElement,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const grids = findGrids(root);
  const stats = findElement<HTMLElement>(root, '[data-role="stats"]');

  for (let tick = 0; tick < TICKS; tick++) {
    clock.at((tick / TICKS) * REVEAL_SECONDS, (time) =>
      sound()?.playTick({
        time,
        semitones: semitonesForDegree(tick % 7),
        intensity: 0.5,
      }),
    );
  }
  clock.at(REVEAL_SECONDS, (time) => sound()?.playAccent(time));

  const shown = grids.map(() => 0);
  let statsOpacity = Number.NaN;

  const render = (seconds: number) => {
    const progress = reducedMotion
      ? seconds >= REVEAL_SECONDS
        ? 1
        : 0
      : Math.min(1, seconds / REVEAL_SECONDS);
    grids.forEach((grid, index) => {
      const groups = Math.ceil(grid.slots.length / grid.groupSize);
      const now = groupsShown(progress, groups);
      const before = shown[index] ?? 0;
      if (now === before) return;
      // Forward reveals only add groups; a jump back hides the later ones.
      const from = Math.min(before, now) * grid.groupSize;
      const to = Math.max(before, now) * grid.groupSize;
      for (let slot = from; slot < to; slot++) {
        const element = grid.slots[slot];
        if (element) element.style.opacity = now > before ? "" : "0";
      }
      shown[index] = now;
    });
    const fade = reducedMotion
      ? seconds >= REVEAL_SECONDS
        ? 1
        : 0
      : Math.min(
          1,
          Math.max(0, (seconds - REVEAL_SECONDS) / STATS_FADE_SECONDS),
        );
    if (fade !== statsOpacity) {
      statsOpacity = fade;
      stats.style.opacity = String(fade);
    }
  };

  // Hide the finished markup before the first frame is painted.
  for (const grid of grids) {
    for (const slot of grid.slots) slot.style.opacity = "0";
  }
  render(0);
  const stop = clock.onFrame(render);
  return () => {
    stop();
    for (const grid of grids) {
      for (const slot of grid.slots) slot.style.opacity = "";
    }
    stats.style.opacity = "";
  };
}
