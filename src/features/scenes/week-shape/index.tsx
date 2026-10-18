import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreWeekShape } from "./explore";
import { mountWeekShape } from "./mount";
import { BPM, planWeekShape } from "./plan";
import { WeekShapeView } from "./WeekShapeView";

/** Scene 4: contributions folded onto the seven days, plus steady or bursty. */
export const weekShapeScene: SceneDefinition = {
  id: "week-shape",
  label: "Week shape",
  create({ history }) {
    if (!history) return null;
    const plan = planWeekShape(history);
    if (!plan) return null;
    return {
      duration: plan.duration,
      bpm: BPM,
      view: <WeekShapeView plan={plan} />,
      mount: (root, runtime) => mountWeekShape(root, plan, runtime),
      explore: (root) => exploreWeekShape(root, plan),
    };
  },
};
