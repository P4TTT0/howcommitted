import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import type { SoundEngine } from "@/playback/sound/engine";

/** Seconds a versus info scene takes to reveal itself, then hold. */
export const REVEAL_SECONDS = 6;
/** Two beats at 120 bpm. */
export const REVEAL_BPM = 120;
const FIRST_AT = 0.5;
const STEP = 0.5;

/** When the group `group` (0, 1, 2...) shows, in seconds on the clock. */
export function revealTime(group: number): number {
  return FIRST_AT + group * STEP;
}

export type RevealOptions = {
  /**
   * Replaces the default tick: called on the beat each group shows, with the
   * group's position in order of appearance. Scenes use it to pick the gesture
   * that matches what appears (for example `stair`).
   */
  onReveal?: (engine: SoundEngine, position: number, time: number) => void;
};

/**
 * The shared reveal of the versus info scenes. Elements marked
 * `data-reveal="<group>"` appear one group at a time, in order, each on a beat
 * with its own tick; the static markup is the finished state, so it is hidden
 * here before the first frame and shown again by the cleanup. Visibility is a
 * pure function of clock time (no timers of our own); under reduced motion
 * everything stays visible and only the sound plays.
 */
export function mountReveal(
  root: HTMLElement,
  { clock, sound, reducedMotion }: SceneRuntime,
  { onReveal }: RevealOptions = {},
): () => void {
  const groups = new Map<number, HTMLElement[]>();
  for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const group = Number(element.dataset.reveal);
    if (Number.isNaN(group)) continue;
    groups.set(group, [...(groups.get(group) ?? []), element]);
  }
  const ordered = [...groups].sort(([a], [b]) => a - b);

  // Everything is already on screen: one sound, not a staircase of nothing.
  const first = ordered[0];
  if (reducedMotion && first) {
    clock.at(revealTime(first[0]), (time) => sound()?.playAccent(time));
  }

  const steps = reducedMotion ? [] : ordered;
  steps.forEach(([group], position) => {
    const isLast = position === steps.length - 1;
    clock.at(revealTime(group), (time) => {
      const engine = sound();
      if (engine && onReveal) {
        onReveal(engine, position, time);
        return;
      }
      engine?.playTick({
        time,
        semitones: semitonesForDegree(position),
        intensity: 0.6,
      });
      if (isLast) engine?.playAccent(time);
    });
  });

  const shown = new Map<number, boolean>();
  const render = (seconds: number) => {
    for (const [group, elements] of ordered) {
      const visible = reducedMotion || seconds >= revealTime(group);
      if (shown.get(group) === visible) continue;
      shown.set(group, visible);
      for (const element of elements) {
        element.style.visibility = visible ? "" : "hidden";
      }
    }
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  const stop = clock.onFrame(render);
  return () => {
    stop();
    for (const [, elements] of ordered) {
      for (const element of elements) element.style.visibility = "";
    }
  };
}

/**
 * The common versus reveal sound: one `stair` step per group, low to high.
 * `base` starts the stair that many steps up the pentatonic scale, so the
 * info scenes that follow each other do not open on the same notes.
 */
export function stairReveal(base = 0): RevealOptions {
  return {
    onReveal: (engine, position, time) => engine.stair(time, base + position),
  };
}
