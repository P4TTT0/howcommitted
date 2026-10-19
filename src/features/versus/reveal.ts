import type { SceneRuntime } from "@/features/sequencer/types";

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
 * with one `stair` step, low to high; the static markup is the finished state,
 * so it is hidden here before the first frame and shown again by the cleanup.
 * Visibility is a pure function of clock time (no timers of our own). Under
 * reduced motion everything shows at once, so only one step sounds.
 *
 * `base` starts the stair that many steps up the pentatonic scale, so the info
 * scenes that follow each other do not open on the same notes.
 */
export function mountReveal(
  root: HTMLElement,
  { clock, sound, reducedMotion }: SceneRuntime,
  base = 0,
): () => void {
  const groups = new Map<number, HTMLElement[]>();
  for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const group = Number(element.dataset.reveal);
    if (Number.isNaN(group)) continue;
    groups.set(group, [...(groups.get(group) ?? []), element]);
  }
  const ordered = [...groups].sort(([a], [b]) => a - b);

  // Sound matches what appears: one step per group, or one for all at once.
  const steps = reducedMotion ? ordered.slice(0, 1) : ordered;
  steps.forEach(([group], position) => {
    clock.at(revealTime(group), (time) =>
      sound()?.stair(time, base + position),
    );
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
