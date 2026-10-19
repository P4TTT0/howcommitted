import type { SceneDefinition } from "@/features/sequencer/types";
import {
  mountReveal,
  REVEAL_BPM,
  REVEAL_SECONDS,
  stairReveal,
} from "@/features/versus/reveal";
import { versusProfiles } from "@/features/versus/versusProfiles";
import { AwardsView } from "./AwardsView";
import { planAwards } from "./plan";

/**
 * Versus scene 7: neutral awards that name a habit ("Longest streak",
 * "Earliest start"). Never a winner, a ranking or a verdict.
 */
export const versusAwardsScene: SceneDefinition = {
  id: "versus-awards",
  label: "Awards",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const plan = planAwards(versusProfiles(versus));
    if (!plan) return null;
    return {
      duration: REVEAL_SECONDS,
      bpm: REVEAL_BPM,
      view: <AwardsView plan={plan} />,
      mount: (root, runtime) => mountReveal(root, runtime, stairReveal),
    };
  },
};
