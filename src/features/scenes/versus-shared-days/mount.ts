import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
import { daySlots, findGrids } from "./paint";
import {
  drawnGroupPopTimes,
  groupsShown,
  REVEAL_SECONDS,
  STATS_FADE_SECONDS,
  type YearData,
} from "./plan";

/**
 * Wires the scene to the sequencer's clock: the year appears week by week on
 * wide screens and month by month on phones, then the numbers fade in. Every
 * value is a pure function of clock time, written per frame only when it
 * changes. A pop per week column (or month block) that draws a day; no timers of
 * its own. Returns the cleanup.
 */
export function mountSharedDays(
  root: HTMLElement,
  { clock, sound, reducedMotion }: SceneRuntime,
  year: YearData,
): () => void {
  const grids = findGrids(root);
  const stats = findElement<HTMLElement>(root, '[data-role="stats"]');

  // Only the layout on screen makes sound: the other one is display:none.
  const audible = grids.find((grid) => grid.container.offsetParent !== null);
  if (audible) {
    const slots = daySlots(audible, year);
    const popTimes = drawnGroupPopTimes(slots, audible.groupSize);
    // Under reduced motion the grid shows at once: one pop stands for all.
    for (const time of reducedMotion ? popTimes.slice(0, 1) : popTimes) {
      clock.at(time, (at) => sound()?.pop(at));
    }
  }

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
