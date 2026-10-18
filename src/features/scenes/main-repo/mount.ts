import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
import { semitonesForDegree } from "@/playback/pitch";
import {
  BAR_SECONDS,
  FLIP_SECONDS,
  type MainRepoPlan,
  progressAt,
  SLAM_SECONDS,
} from "./plan";

/** How much larger than final size the name starts before it slams in. */
const SLAM_OVERSHOOT = 0.35;
const FLIP_DEGREES = 90;

/**
 * Wires the scene to the sequencer's clock: the name slams in, the bars grow,
 * then the era tiles flip in one by one. Every value is a pure function of
 * clock time, written per frame only when it changes. One accent for the name
 * and one soft tick per bar and tile are scheduled. No timers of its own.
 */
export function mountMainRepo(
  root: HTMLElement,
  plan: MainRepoPlan,
  { clock, sound, reducedMotion }: SceneRuntime,
): () => void {
  const name = findElement<HTMLElement>(root, '[data-role="name"]');
  const fills = plan.bars.map((_, index) =>
    findElement<HTMLElement>(root, `[data-item="${index}"] [data-role="fill"]`),
  );
  const tiles = plan.eras.map((_, index) =>
    findElement<HTMLElement>(root, `[data-item="${plan.bars.length + index}"]`),
  );

  clock.at(plan.slamTime, (time) => sound()?.playAccent(time));
  for (const entry of [...plan.bars, ...plan.eras]) {
    clock.at(entry.time, (time) => {
      sound()?.playTick({
        time,
        semitones: semitonesForDegree(entry.degree),
        intensity: 0.5,
      });
    });
  }

  let nameShown = Number.NaN;
  const barsShown = plan.bars.map(() => Number.NaN);
  const erasShown = plan.eras.map(() => Number.NaN);

  const render = (seconds: number) => {
    const slam = progressAt(
      plan.slamTime,
      SLAM_SECONDS,
      seconds,
      reducedMotion,
    );
    if (slam !== nameShown) {
      nameShown = slam;
      name.style.opacity = String(slam);
      name.style.transform = `scale(${1 + SLAM_OVERSHOOT * (1 - slam)})`;
    }
    plan.bars.forEach((bar, index) => {
      const progress = progressAt(
        bar.time,
        BAR_SECONDS,
        seconds,
        reducedMotion,
      );
      if (progress === barsShown[index]) return;
      barsShown[index] = progress;
      const fill = fills[index];
      if (fill) fill.style.transform = `scaleX(${progress})`;
    });
    plan.eras.forEach((era, index) => {
      const progress = progressAt(
        era.time,
        FLIP_SECONDS,
        seconds,
        reducedMotion,
      );
      if (progress === erasShown[index]) return;
      erasShown[index] = progress;
      const tile = tiles[index];
      if (!tile) return;
      tile.style.opacity = String(progress);
      tile.style.transform = `perspective(600px) rotateX(${FLIP_DEGREES * (1 - progress)}deg)`;
    });
  };

  // Hide the finished markup before the first frame is painted.
  render(0);
  const stop = clock.onFrame(render);
  return () => {
    stop();
    name.style.opacity = "";
    name.style.transform = "";
    for (const fill of fills) fill.style.transform = "";
    for (const tile of tiles) {
      tile.style.opacity = "";
      tile.style.transform = "";
    }
  };
}
