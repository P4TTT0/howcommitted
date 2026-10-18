import type { SceneDefinition } from "@/features/sequencer/types";
import {
  mountReveal,
  REVEAL_BPM,
  REVEAL_SECONDS,
} from "@/features/versus/reveal";
import { versusProfiles } from "@/features/versus/versusProfiles";
import { planRhythmSync } from "./plan";
import { RhythmSyncView } from "./RhythmSyncView";

/**
 * Versus scene 6: every developer's weekly shape side by side, and how much
 * each pair of weeks overlaps. It describes shapes; it never ranks people.
 */
export const versusRhythmSyncScene: SceneDefinition = {
  id: "versus-rhythm-sync",
  label: "Rhythm sync",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const plan = planRhythmSync(versusProfiles(versus));
    if (!plan) return null;
    return {
      duration: REVEAL_SECONDS,
      bpm: REVEAL_BPM,
      view: <RhythmSyncView plan={plan} />,
      mount: (root, runtime) => mountReveal(root, runtime),
    };
  },
};
