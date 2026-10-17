import type { SceneDefinition } from "@/features/sequencer/types";
import { CumulativeLineView } from "./CumulativeLineView";
import { mountCumulativeLine } from "./mount";
import { BPM, TOTAL_SECONDS } from "./plan";

/** Scene 2: cumulative contributions drawn as one line, with payoff floods. */
export const cumulativeLineScene: SceneDefinition = {
  id: "cumulative-line",
  label: "Cumulative line",
  create({ model }) {
    const { plan, note } = model;
    if (plan.total === 0 || plan.days.length === 0) return null;
    return {
      duration: TOTAL_SECONDS,
      bpm: BPM,
      view: <CumulativeLineView plan={plan} note={note} />,
      mount: (root, runtime) => mountCumulativeLine(root, plan, runtime),
    };
  },
};
