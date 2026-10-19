import type { SceneDefinition } from "@/features/sequencer/types";
import { REVEAL_BPM, REVEAL_SECONDS } from "@/features/versus/reveal";
import { versusProfiles } from "@/features/versus/versusProfiles";
import { mountStreaks } from "./mount";
import { planStreaks } from "./plan";
import { StreaksView } from "./StreaksView";

/**
 * Versus scene 5: each developer's longest run of days in a row and longest
 * quiet stretch on one shared timeline. Rows keep the order the developers
 * were added in; nothing is ranked.
 */
export const versusStreaksScene: SceneDefinition = {
  id: "versus-streaks",
  label: "Longest streaks",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const plan = planStreaks(versusProfiles(versus));
    if (!plan) return null;
    return {
      duration: REVEAL_SECONDS,
      bpm: REVEAL_BPM,
      view: <StreaksView plan={plan} />,
      mount: (root, runtime) => mountStreaks(root, plan, runtime),
    };
  },
};
