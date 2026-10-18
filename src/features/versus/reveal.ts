import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";

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
): () => void {
  const groups = new Map<number, HTMLElement[]>();
  for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const group = Number(element.dataset.reveal);
    if (Number.isNaN(group)) continue;
    groups.set(group, [...(groups.get(group) ?? []), element]);
  }
  const ordered = [...groups].sort(([a], [b]) => a - b);

  ordered.forEach(([group], position) => {
    const isLast = position === ordered.length - 1;
    clock.at(revealTime(group), (time) => {
      const engine = sound();
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
