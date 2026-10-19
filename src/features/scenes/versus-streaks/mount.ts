import type { SceneRuntime } from "@/features/sequencer/types";
import { revealTime } from "@/features/versus/reveal";
import { type StreaksPlan, streakPops } from "./plan";

/**
 * The reveal of the streaks scene: each row (`data-reveal`) appears on its
 * beat, then its quiet block and its streak block (`data-block`) one grid slot
 * apart. A pop sounds with each, at the clock time it becomes visible. Under
 * reduced motion everything stays visible and only the sound plays. No timers
 * of its own.
 */
export function mountStreaks(
  root: HTMLElement,
  plan: StreaksPlan,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const pops = streakPops(plan);
  const hidden: { element: HTMLElement; time: number }[] = [];
  for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const group = Number(element.dataset.reveal);
    if (Number.isNaN(group)) continue;
    hidden.push({ element, time: revealTime(group) });
  }
  plan.rows.forEach((row, position) => {
    // A row exists twice: the desktop timeline and the phone list.
    for (const li of root.querySelectorAll<HTMLElement>(
      `[data-reveal="${row.index}"]`,
    )) {
      for (const pop of pops) {
        if (pop.row !== position || pop.kind === "row") continue;
        const block = li.querySelector<HTMLElement>(
          `[data-block="${pop.kind}"]`,
        );
        if (block) hidden.push({ element: block, time: pop.time });
      }
    }
  });

  // Build everything above before scheduling: a throw leaves nothing behind.
  // Under reduced motion every row shows at once: one pop stands for all.
  for (const { time } of reducedMotion ? pops.slice(0, 1) : pops) {
    clock.at(time, (at) => sound()?.pop(at));
  }

  const shown = new Map<HTMLElement, boolean>();
  const render = (seconds: number) => {
    for (const { element, time } of hidden) {
      const visible = reducedMotion || seconds >= time;
      if (shown.get(element) === visible) continue;
      shown.set(element, visible);
      element.style.visibility = visible ? "" : "hidden";
    }
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  const stop = clock.onFrame(render);
  return () => {
    stop();
    for (const { element } of hidden) element.style.visibility = "";
  };
}
