import { findElement } from "@/features/sequencer/explore";
import type { SceneRuntime } from "@/features/sequencer/types";
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
/** The stair gesture has ten steps (0..9). */
const MAX_STAIR_INDEX = 9;

/**
 * Wires the scene to the sequencer's clock: the name slams in, the bars grow,
 * then the era tiles flip in one by one. Every value is a pure function of
 * clock time, written per frame only when it changes. Each bar gets a fill and
 * a stair step, each tile a stair step. No timers of its own.
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

  // Each repo bar loads (fill) and steps up the stair as its row appears;
  // the era tiles run their own stair as each one flips in.
  plan.bars.forEach((bar, index) => {
    clock.at(bar.time, (time) => {
      const engine = sound();
      engine?.fill(time, BAR_SECONDS);
      engine?.stair(time, Math.min(MAX_STAIR_INDEX, index));
    });
  });
  plan.eras.forEach((era, index) => {
    clock.at(era.time, (time) =>
      sound()?.stair(time, Math.min(MAX_STAIR_INDEX, index)),
    );
  });

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
