import type { SceneDefinition } from "@/features/sequencer/types";
import { BigNumbersView } from "./BigNumbersView";
import { exploreBigNumbers } from "./explore";
import { mountBigNumbers } from "./mount";
import { BPM, planBigNumbers } from "./numbers";

/** Scene 5: commits, pull requests, reviews and issues, from the history totals. */
export const bigNumbersScene: SceneDefinition = {
  id: "big-numbers",
  label: "Big numbers",
  create({ history }) {
    if (!history) return null;
    const plan = planBigNumbers(history);
    if (!plan) return null;
    return {
      duration: plan.duration,
      bpm: BPM,
      view: <BigNumbersView plan={plan} />,
      mount: (root, runtime) => mountBigNumbers(root, plan.numbers, runtime),
      explore: (root) => exploreBigNumbers(root, plan.numbers),
    };
  },
};
