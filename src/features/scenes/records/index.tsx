import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreRecords } from "./explore";
import { mountRecords } from "./mount";
import { BPM, planRecords } from "./plan";
import { RecordsView } from "./RecordsView";

/** Scene 5: the longest streak and eight habit records. */
export const recordsScene: SceneDefinition = {
  id: "records",
  label: "Records",
  create({ history }) {
    if (!history) return null;
    const plan = planRecords(history);
    if (!plan) return null;
    return {
      duration: plan.duration,
      bpm: BPM,
      view: <RecordsView plan={plan} />,
      mount: (root, runtime) => mountRecords(root, plan, runtime),
      explore: (root) => exploreRecords(root, plan),
    };
  },
};
