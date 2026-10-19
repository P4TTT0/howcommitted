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

  // Each bar loads as it grows and climbs to its own height relative to the
  // tallest, so a short bar is a short, low fill and the tallest reaches the top.
  const audible = plan.bars.filter((bar) => bar.ratio > 0);
  // Under reduced motion the bars show at once: one fill stands for all.
  for (const bar of reducedMotion ? audible.slice(0, 1) : audible) {
    const to = bar.ratio;
    clock.at(bar.start, (time) =>
      sound()?.fill(time, (bar.land - bar.start) * to, { to }),
    );
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
