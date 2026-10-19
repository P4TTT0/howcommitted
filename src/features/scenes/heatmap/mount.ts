import type { SceneRuntime } from "@/features/sequencer/types";
import { type HeatmapPlan, weekProgress } from "./plan";

/**
 * Wires the reveal to the sequencer's clock. Each week column's opacity is a
 * pure function of clock time; sound is one pop per drawn week, on the grid.
 */
export function mountHeatmap(
  root: HTMLElement,
  plan: HeatmapPlan,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const columns: HTMLElement[][] = Array.from({ length: plan.weeks }, () => []);
  for (const element of root.querySelectorAll<HTMLElement>("[data-week]")) {
    columns[Number(element.dataset.week)]?.push(element);
  }

  for (const { time, db } of plan.pops) {
    clock.at(time, (at) => sound()?.pop(at, { db }));
  }

  const shown = plan.weekTimes.map(() => Number.NaN);
  const render = (seconds: number) => {
    plan.weekTimes.forEach((time, week) => {
      const progress = weekProgress(time, seconds, reducedMotion);
      if (progress === shown[week]) return;
      shown[week] = progress;
      for (const element of columns[week] ?? []) {
        element.style.opacity = String(progress);
      }
    });
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  return clock.onFrame(render);
}
