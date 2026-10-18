import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreThenNow } from "./explore";
import { mountThenNow } from "./mount";
import { BPM, planThenNow } from "./plan";
import { ThenNowView } from "./ThenNowView";

/** Extra scene: a past year against the last full year, picked in explore. */
export const thenNowScene: SceneDefinition = {
  id: "then-now",
  label: "Then vs now",
  create({ history }) {
    if (!history) return null;
    const plan = planThenNow(history);
    if (!plan) return null;
    return {
      duration: plan.duration,
      bpm: BPM,
      view: <ThenNowView plan={plan} />,
      mount: (root, runtime) => mountThenNow(root, plan, runtime),
      explore: (root) => exploreThenNow(root, plan),
    };
  },
};
