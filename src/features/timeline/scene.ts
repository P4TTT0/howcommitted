import gsap from "gsap";
import { cumulativeAt, yearAt } from "@/playback/aggregate";
import { PlaybackClock } from "@/playback/clock";
import { degreeForAccumulation, semitonesForDegree } from "@/playback/pitch";
import { SoundEngine } from "@/playback/sound/engine";
import { CHART_WIDTH, topPercent } from "./chart";
import {
  BPM,
  blockForYearIndex,
  DRAW_SECONDS,
  type Plan,
  TOTAL_SECONDS,
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

const numberFormat = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

/** Index of the year in effect at a progress, for block color rotation. */
export function yearIndexAt(plan: Plan, progress: number): number {
  const year = yearAt(plan.years, progress);
  return Math.max(
    0,
    plan.years.findIndex((span) => span.year === year),
  );
}

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
  await clock.unlock();

  // Sound is optional: if the samples fail to load the scene still plays.
  let engine: SoundEngine | null = null;
  try {
    engine = await SoundEngine.load();
    engine.setMuted(muted);
  } catch {
    engine = null;
  }

  scheduleSound(clock, () => engine, plan);

  const timeline = gsap.timeline({ paused: true });
  if (!reducedMotion) addPayoffMotion(timeline, root, plan);

  const stopDriving = clock.drive(timeline);
  const stopRendering = clock.onFrame(createRenderer(root, plan));

  return {
    clock,
    setMuted: (next) => engine?.setMuted(next),
    dispose() {
      stopDriving();
      stopRendering();
      timeline.kill();
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
    const semitones = semitonesForDegree(
      degreeForAccumulation(slot.runAccumulated),
    );
    clock.at(slot.time, (time) =>
      getEngine()?.playTick({ time, semitones, intensity: slot.intensity }),
    );
  }
  for (const milestone of plan.milestones) {
    clock.at(milestone.time, (time) =>
      getEngine()?.playPayoff({ time, kind: milestone.kind }),
    );
  }
}

/** Floods and shakes, placed on the timeline at each payoff time. */
function addPayoffMotion(
  timeline: gsap.core.Timeline,
  root: HTMLElement,
  plan: Plan,
) {
  const shake = find<HTMLElement>(root, '[data-role="shake"]');
  plan.milestones.forEach((milestone, index) => {
    const layer = find<HTMLElement>(root, `[data-flood="${index}"]`);
    const final = milestone.kind === "final";
    const rise = 0.12;
    const hold = final ? 1.4 : 0.35;
    const fall = final ? 0.7 : 0.5;
    const start = milestone.time;
    const recede = start + rise + hold;
    const amount = final ? 22 : 12;

    timeline
      .set(layer, { transformOrigin: "50% 100%", scaleY: 0 }, 0)
      .fromTo(
        layer,
        { scaleY: 0 },
        { scaleY: 1, duration: rise, ease: "power4.out" },
        start,
      )
      .set(layer, { transformOrigin: "50% 0%" }, recede)
      .to(layer, { scaleY: 0, duration: fall, ease: "power3.in" }, recede)
      .fromTo(
        shake,
        { x: 0 },
        {
          keyframes: { x: [-amount, amount, -amount * 0.6, amount * 0.3, 0] },
          duration: 0.28,
          ease: "none",
        },
        recede + fall - 0.05,
      );
  });
}

/** Values that are a pure function of clock time; written only on change. */
function createRenderer(root: HTMLElement, plan: Plan) {
  const block = find<HTMLElement>(root, '[data-role="block"]');
  const yearLabel = find<HTMLElement>(root, '[data-role="year"]');
  const totalLabel = find<HTMLElement>(root, '[data-role="total"]');
  const clip = find<SVGRectElement>(root, '[data-role="clip"]');
  const head = find<HTMLElement>(root, '[data-role="head"]');
  let lastYear = Number.NaN;
  let lastTotal = Number.NaN;

  return (seconds: number) => {
    const progress = Math.min(1, seconds / DRAW_SECONDS);

    const year = yearAt(plan.years, progress);
    if (year !== lastYear) {
      lastYear = year;
      const colors = blockForYearIndex(yearIndexAt(plan, progress));
      block.style.backgroundColor = colors.background;
      block.style.color = colors.foreground;
      yearLabel.textContent = String(year);
    }

    const running = cumulativeAt(plan.cumulative, progress);
    const rounded = Math.round(running);
    if (rounded !== lastTotal) {
      lastTotal = rounded;
      totalLabel.textContent = formatCount(rounded);
    }

    clip.setAttribute("width", String(progress * CHART_WIDTH));
    head.style.left = `${progress * 100}%`;
    head.style.top = `${topPercent(plan, running)}%`;
  };
}
