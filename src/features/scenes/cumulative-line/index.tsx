import { BPM, TOTAL_SECONDS } from "@/features/sequencer/model/plan";
import type { SceneDefinition } from "@/features/sequencer/types";
import { CumulativeLineView } from "./CumulativeLineView";
import { exploreCumulativeLine } from "./explore";
import { mountCumulativeLine } from "./mount";
import { flagMarks } from "./scrub";

/** Scene 2: cumulative contributions drawn as one line, with payoff floods. */
export const cumulativeLineScene: SceneDefinition = {
  id: "cumulative-line",
  label: "Cumulative line",
  create({ model }) {
    const { plan, note } = model;
    if (plan.total === 0 || plan.days.length === 0) return null;
    const marks = flagMarks(model.repoFlags, plan.days);
    return {
      duration: TOTAL_SECONDS,
      bpm: BPM,
      view: <CumulativeLineView plan={plan} note={note} marks={marks} />,
      mount: (root, runtime) => mountCumulativeLine(root, plan, runtime),
      explore: (root) => exploreCumulativeLine(root, plan, marks),
    };
  },
};
