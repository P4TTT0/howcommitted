import { formatCount } from "@/features/sequencer/model/format";
import { DRAW_SECONDS, type Plan } from "@/features/sequencer/model/plan";
import type { SceneRuntime } from "@/features/sequencer/types";
import { cumulativeAt } from "@/playback/aggregate";
import type { PlaybackClock } from "@/playback/clock";
import { growthRuns } from "@/playback/growth";
import type { SoundEngine } from "@/playback/sound/engine";
import { scheduleFill } from "@/playback/sound/ticks";
import { CHART_WIDTH, topPercent } from "./chart";
import { slotX, type YearSlot, yearFill } from "./years";

function find<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing scene element: ${selector}`);
  return element;
}

/**
 * Wires the timeline to the sequencer's clock: sound scheduled on the
 * Transport and one per-frame renderer for everything that is a pure function
 * of time (the counter, the line, the blocks filling, the flags). The DOM is
 * addressed through data attributes so React stays out of the 60 fps path.
 * Returns the cleanup; nothing is left scheduled if the wiring throws.
 */
export function mountTimeline(
  root: HTMLElement,
  plan: Plan,
  slots: readonly YearSlot[],
  { clock, sound }: SceneRuntime,
): () => void {
  const render = createRenderer(root, plan, slots);
  const stopRendering = clock.onFrame(render);
  // Last, so nothing is left scheduled if anything above threw.
  scheduleSound(clock, sound, plan);
  return stopRendering;
}

/**
 * One continuous climb over the whole draw, played only while the running
 * total rises. Each growth run covers the share of the climb it adds, so the
 * pitch follows the growing total and flat stretches stay silent.
 */
function scheduleSound(
  clock: PlaybackClock,
  getEngine: () => SoundEngine | null,
  plan: Plan,
) {
  for (const { start, duration, from, to } of growthRuns(
    plan.cumulative,
    DRAW_SECONDS,
  )) {
    scheduleFill(clock, getEngine, start, duration, { from, to });
  }
}

/** The running total is a pure function of clock time; written on change. */
function createRenderer(
  root: HTMLElement,
  plan: Plan,
  slots: readonly YearSlot[],
) {
  const total = find<HTMLElement>(root, '[data-role="total"]');
  const clip = find<SVGRectElement>(root, '[data-role="clip"]');
  const head = find<HTMLElement>(root, '[data-role="head"]');
  const bars = slots.map((_, index) =>
    find<HTMLElement>(root, `[data-bar="${index}"]`),
  );
  const fills = slots.map(() => Number.NaN);
  const labels = [
    ...root.querySelectorAll<HTMLElement>("[data-step-label]"),
  ].map((element) => ({
    element,
    at: Number(element.dataset.stepLabel),
    shown: false,
  }));
  const flags = [...root.querySelectorAll<HTMLElement>("[data-flag]")].map(
    (element) => ({
      element,
      at: Number(element.dataset.at),
      shown: false,
    }),
  );
  let lastTotal = Number.NaN;

  return (seconds: number) => {
    const progress = Math.min(1, seconds / DRAW_SECONDS);

    const running = cumulativeAt(plan.cumulative, progress);
    const rounded = Math.round(running);
    if (rounded !== lastTotal) {
      lastTotal = rounded;
      total.textContent = formatCount(rounded);
    }

    // A block fills as the line crosses its year.
    slots.forEach((slot, index) => {
      const fill = Math.round(yearFill(slot, running) * 1000) / 1000;
      if (fill === fills[index]) return;
      fills[index] = fill;
      const bar = bars[index];
      if (bar) bar.style.transform = `scaleY(${fill})`;
    });

    // A step label appears the instant the line reaches its step (also with
    // reduced motion: it is a switch, not an animation).
    for (const label of labels) {
      const shown = progress >= label.at;
      if (shown !== label.shown) {
        label.shown = shown;
        label.element.dataset.visible = String(shown);
      }
    }

    // A repo flag is planted the instant the line reaches its day.
    for (const flag of flags) {
      const shown = progress >= flag.at;
      if (shown !== flag.shown) {
        flag.shown = shown;
        flag.element.dataset.visible = String(shown);
      }
    }

    const x = slotX(slots, progress);
    clip.setAttribute("width", String(x * CHART_WIDTH));
    head.style.left = `${x * 100}%`;
    head.style.top = `${topPercent(plan, running)}%`;
  };
}
