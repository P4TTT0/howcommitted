import type { SceneDefinition } from "@/features/sequencer/types";
import {
  mountReveal,
  REVEAL_BPM,
  REVEAL_SECONDS,
  stairReveal,
} from "@/features/versus/reveal";
import { versusProfiles } from "@/features/versus/versusProfiles";
import { LanguagesView } from "./LanguagesView";
import { planLanguages } from "./plan";

/**
 * Versus scene 4: the languages of each developer's own public repositories,
 * a card each in the order they were added. No ranking between developers.
 */
export const versusLanguagesScene: SceneDefinition = {
  id: "versus-languages",
  label: "Favorite languages",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const plan = planLanguages(versusProfiles(versus));
    if (!plan) return null;
    return {
      duration: REVEAL_SECONDS,
      bpm: REVEAL_BPM,
      view: <LanguagesView plan={plan} />,
      mount: (root, runtime) => mountReveal(root, runtime, stairReveal(0)),
    };
  },
};
