import { formatCount } from "@/features/sequencer/model/format";
import {
  DRAW_SECONDS,
  GRID_SECONDS,
  type Plan,
  stepCueTimes,
} from "@/features/sequencer/model/plan";
import type { SceneRuntime } from "@/features/sequencer/types";
import { cumulativeAt } from "@/playback/aggregate";
import type { PlaybackClock } from "@/playback/clock";
import { semitonesForDegree } from "@/playback/pitch";
import { quantizeUp } from "@/playback/schedule";
import type { SoundEngine } from "@/playback/sound/engine";
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
  scheduleSound(clock, sound, plan, slots);
  return stopRendering;
}

function scheduleSound(
  clock: PlaybackClock,
  getEngine: () => SoundEngine | null,
  plan: Plan,
  slots: readonly YearSlot[],
) {
  const payoffTimes = new Set(plan.milestones.map((m) => m.time));
  for (const slot of plan.slots) {
    // A payoff takes over its own beat.
    if (payoffTimes.has(slot.time)) continue;
    const semitones = semitonesForDegree(slot.degree);
    clock.at(slot.time, (time) =>
      getEngine()?.playTick({ time, semitones, intensity: slot.intensity }),
    );
  }
  for (const milestone of plan.milestones) {
    clock.at(milestone.time, (time) =>
      getEngine()?.playPayoff({ time, kind: milestone.kind }),
    );
  }
  // The year accent lands as the line crosses into the next block.
  for (const slot of slots.slice(1)) {
    const time = quantizeUp(slot.startProgress * DRAW_SECONDS, GRID_SECONDS);
    if (payoffTimes.has(time)) continue;
    clock.at(time, (at) => getEngine()?.playAccent(at));
  }
  for (const time of stepCueTimes(plan)) {
    clock.at(time, (at) => getEngine()?.playUnattributed(at));
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
