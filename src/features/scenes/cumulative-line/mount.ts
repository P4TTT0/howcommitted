import gsap from "gsap";
import { formatCount } from "@/features/sequencer/model/format";
import {
  DRAW_SECONDS,
  FLOOD,
  type Plan,
  stepCueTimes,
  YEAR_WIPE_SECONDS,
  yearReveals,
} from "@/features/sequencer/model/plan";
import type { SceneRuntime } from "@/features/sequencer/types";
import { cumulativeAt } from "@/playback/aggregate";
import type { PlaybackClock } from "@/playback/clock";
import { semitonesForDegree } from "@/playback/pitch";
import type { SoundEngine } from "@/playback/sound/engine";
import { CHART_WIDTH, topPercent } from "./chart";

/**
 * Wires the cumulative line to the sequencer's clock: sound scheduled on the
 * Transport, a paused GSAP timeline seeked by the clock, and a per-frame
 * renderer for the values that are a pure function of time. The DOM is
 * addressed through data attributes so React stays out of the 60 fps path.
 */

function find<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing scene element: ${selector}`);
  return element;
}

/** Returns the cleanup; anything half-built is undone if wiring throws. */
export function mountCumulativeLine(
  root: HTMLElement,
  plan: Plan,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const timeline = gsap.timeline({ paused: true });
  try {
    addYearMotion(timeline, root, plan, reducedMotion);
    if (!reducedMotion) addPayoffMotion(timeline, root, plan);
  } catch (error) {
    timeline.kill();
    throw error;
  }

  let render: (seconds: number) => void;
  try {
    render = createRenderer(root, plan);
  } catch (error) {
    timeline.kill();
    throw error;
  }

  const stopDriving = clock.drive(timeline);
  const stopRendering = clock.onFrame(render);
  // Last, so nothing is left scheduled if anything above threw.
  scheduleSound(clock, sound, plan);
  return () => {
    stopDriving();
    stopRendering();
    timeline.kill();
  };
}

function scheduleSound(
  clock: PlaybackClock,
  getEngine: () => SoundEngine | null,
  plan: Plan,
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
  for (const reveal of yearReveals(plan).slice(1)) {
    clock.at(reveal.time, (time) => getEngine()?.playAccent(time));
  }
  for (const time of stepCueTimes(plan)) {
    clock.at(time, (at) => getEngine()?.playUnattributed(at));
  }
}

/** Each year's block wipes in from the left with a decisive, no-bounce ease. */
function addYearMotion(
  timeline: gsap.core.Timeline,
  root: HTMLElement,
  plan: Plan,
  reducedMotion: boolean,
) {
  const hidden = "inset(0% 100% 0% 0%)";
  const shown = "inset(0% 0% 0% 0%)";
  for (const reveal of yearReveals(plan).slice(1)) {
    const layer = find<HTMLElement>(
      root,
      `[data-year-layer="${reveal.index}"]`,
    );
    if (reducedMotion) {
      timeline.set(layer, { clipPath: hidden }, 0);
      timeline.set(layer, { clipPath: shown }, reveal.time);
    } else {
      timeline.fromTo(
        layer,
        { clipPath: hidden },
        { clipPath: shown, duration: YEAR_WIPE_SECONDS, ease: "power4.out" },
        reveal.time,
      );
    }
  }
}

/** Floods, placed on the timeline at each payoff time. */
function addPayoffMotion(
  timeline: gsap.core.Timeline,
  root: HTMLElement,
  plan: Plan,
) {
  plan.milestones.forEach((milestone, index) => {
    const layer = find<HTMLElement>(root, `[data-flood="${index}"]`);
    const number = find<HTMLElement>(layer, "[data-flood-number]");
    const { hold, fall } = FLOOD[milestone.kind];
    const start = milestone.time;
    const recede = start + FLOOD.rise + hold;

    timeline
      .set(layer, { transformOrigin: "50% 100%", scaleY: 0 }, 0)
      .fromTo(
        layer,
        { scaleY: 0 },
        { scaleY: 1, duration: FLOOD.rise, ease: "power4.out" },
        start,
      )
      // The number lands with a quick scale-down: impact without overshoot.
      .fromTo(
        number,
        { scale: 1.2 },
        { scale: 1, duration: 0.25, ease: "power4.out" },
        start,
      )
      .set(layer, { transformOrigin: "50% 0%" }, recede)
      .to(layer, { scaleY: 0, duration: fall, ease: "power3.in" }, recede);
  });
}

/** The running total is a pure function of clock time; written on change. */
function createRenderer(root: HTMLElement, plan: Plan) {
  const totals = [...root.querySelectorAll<HTMLElement>('[data-role="total"]')];
  const clip = find<SVGRectElement>(root, '[data-role="clip"]');
  const head = find<HTMLElement>(root, '[data-role="head"]');
  const labels = [
    ...root.querySelectorAll<HTMLElement>("[data-step-label]"),
  ].map((element) => ({
    element,
    at: Number(element.dataset.stepLabel),
    shown: false,
  }));
  let lastTotal = Number.NaN;

  return (seconds: number) => {
    const progress = Math.min(1, seconds / DRAW_SECONDS);

    const running = cumulativeAt(plan.cumulative, progress);
    const rounded = Math.round(running);
    if (rounded !== lastTotal) {
      lastTotal = rounded;
      const text = formatCount(rounded);
      for (const total of totals) total.textContent = text;
    }

    // A step label appears the instant the line reaches its step (also with
    // reduced motion: it is a switch, not an animation).
    for (const label of labels) {
      const shown = progress >= label.at;
      if (shown !== label.shown) {
        label.shown = shown;
        label.element.dataset.visible = String(shown);
      }
    }

    clip.setAttribute("width", String(progress * CHART_WIDTH));
    head.style.left = `${progress * 100}%`;
    head.style.top = `${topPercent(plan, running)}%`;
  };
}
