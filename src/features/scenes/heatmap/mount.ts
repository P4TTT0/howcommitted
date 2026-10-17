import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import { type HeatmapPlan, weekProgress } from "./plan";

/**
 * Wires the reveal to the sequencer's clock. Each week column's opacity is a
 * pure function of clock time; sound is one tick per few weeks, on the grid.
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

  plan.ticks.forEach((tick, index) => {
    const isLast = index === plan.ticks.length - 1;
    clock.at(tick.time, (time) => {
      const engine = sound();
      engine?.playTick({
        time,
        semitones: semitonesForDegree(tick.degree),
        intensity: tick.intensity,
      });
      if (isLast) engine?.playAccent(time);
    });
  });

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
