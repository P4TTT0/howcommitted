import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
import { growthAt, rhythmProgressAt, type WeekPlan } from "./plan";

/**
 * Wires the bars and the rhythm marker to the sequencer's clock. Heights are a
 * pure function of clock time; one fill per bar rises in pitch as it grows. No timers of its own.
 */
export function mountWeekShape(
  root: HTMLElement,
  plan: WeekPlan,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const bars = plan.bars.map((bar) =>
    findElement<HTMLElement>(root, `[data-bar="${bar.index}"]`),
  );
  const fill = findElement<HTMLElement>(root, '[data-role="rhythm-fill"]');
  const marker = findElement<HTMLElement>(root, '[data-role="rhythm-marker"]');
  const place = plan.position * 100;

  // Each bar loads as it grows: one fill over its own growth.
  for (const bar of plan.bars) {
    clock.at(bar.start, (time) => sound()?.fill(time, bar.land - bar.start));
  }

  const shownBars = plan.bars.map(() => Number.NaN);
  let shownRhythm = Number.NaN;
  const render = (seconds: number) => {
    plan.bars.forEach((bar, index) => {
      const growth = growthAt(bar, seconds, reducedMotion);
      if (growth === shownBars[index]) return;
      shownBars[index] = growth;
      const element = bars[index];
      if (element) element.style.height = `${bar.ratio * growth * 100}%`;
    });
    const progress = rhythmProgressAt(plan, seconds, reducedMotion);
    if (progress !== shownRhythm) {
      shownRhythm = progress;
      fill.style.width = `${place * progress}%`;
      marker.style.left = `calc(${place * progress}% - 2px)`;
    }
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  return clock.onFrame(render);
}
