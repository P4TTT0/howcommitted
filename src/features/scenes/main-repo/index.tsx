import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreMainRepo } from "./explore";
import { MainRepoView } from "./MainRepoView";
import { mountMainRepo } from "./mount";
import { BPM, planMainRepo } from "./plan";

/** Scene 3: the public repo with the most commits, the top five, and the eras. */
export const mainRepoScene: SceneDefinition = {
  id: "main-repo",
  label: "Main repo + eras",
  create({ history, model }) {
    if (!history) return null;
    const plan = planMainRepo(history, model.firstYear);
    if (!plan) return null;
    return {
      duration: plan.duration,
      bpm: BPM,
      view: <MainRepoView plan={plan} />,
      mount: (root, runtime) => mountMainRepo(root, plan, runtime),
      explore: (root) => exploreMainRepo(root, plan.readings),
    };
  },
};
