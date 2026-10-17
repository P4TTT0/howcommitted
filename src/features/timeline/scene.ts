import gsap from "gsap";
import { cumulativeAt } from "@/playback/aggregate";
import { PlaybackClock } from "@/playback/clock";
import { semitonesForDegree } from "@/playback/pitch";
import { SoundEngine } from "@/playback/sound/engine";
import { CHART_WIDTH, topPercent } from "./chart";
import { formatCount } from "./format";
import {
  BPM,
  DRAW_SECONDS,
  FLOOD,
  type Plan,
  stepCueTimes,
  TOTAL_SECONDS,
  YEAR_WIPE_SECONDS,
  yearReveals,
} from "./plan";

/**
 * Wires one playback run: sound scheduled on the Transport, a paused GSAP
 * timeline seeked by the clock, and a per-frame renderer for the values that
 * are a pure function of time. The DOM is addressed through data attributes
 * so React stays out of the 60 fps path.
 */

export type Scene = {
  clock: PlaybackClock;
  setMuted(muted: boolean): void;
  dispose(): void;
};

export type SceneOptions = {
  root: HTMLElement;
  plan: Plan;
  muted: boolean;
  reducedMotion: boolean;
};

export { formatCount };

function find<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing scene element: ${selector}`);
  return element;
}

export async function createScene({
  root,
  plan,
  muted,
  reducedMotion,
}: SceneOptions): Promise<Scene> {
  const clock = new PlaybackClock({ duration: TOTAL_SECONDS, bpm: BPM });
  let engine: SoundEngine | null = null;
  let timeline: gsap.core.Timeline | null = null;

  // Anything half-built is torn down, including Transport events, on failure.
  try {
    await clock.unlock();

    // Sound is optional: if the samples fail to load the scene still plays.
    try {
      engine = await SoundEngine.load();
      engine.setMuted(muted);
    } catch {
      engine = null;
    }

    scheduleSound(clock, () => engine, plan);

    timeline = gsap.timeline({ paused: true });
    addYearMotion(timeline, root, plan, reducedMotion);
    if (!reducedMotion) addPayoffMotion(timeline, root, plan);
  } catch (error) {
    timeline?.kill();
    clock.dispose();
    engine?.dispose();
    throw error;
  }

  const stopDriving = clock.drive(timeline);
  const stopRendering = clock.onFrame(createRenderer(root, plan));
  const built = timeline;

  return {
    clock,
    setMuted: (next) => engine?.setMuted(next),
    dispose() {
      stopDriving();
      stopRendering();
      built.kill();
      clock.dispose();
      engine?.dispose();
    },
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
