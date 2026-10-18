import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreSharedDays } from "./explore";
import { mountSharedDays } from "./mount";
import { BPM, buildSharedDays, TOTAL_SECONDS } from "./plan";
import { SharedDaysView } from "./SharedDaysView";

/**
 * Versus scene 3: a calendar year of days, each one split between the
 * developers who contributed on it, with how many days all of them showed up,
 * how many days at least one did and the longest run together. Explore picks
 * the year and the day. Calendar contributions of every type; nobody is
 * ranked.
 */
export const versusSharedDaysScene: SceneDefinition = {
  id: "versus-shared-days",
  label: "Shared days",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const model = buildSharedDays(versus);
    if (!model) return null;
    return {
      duration: TOTAL_SECONDS,
      bpm: BPM,
      view: <SharedDaysView model={model} />,
      mount: (root, runtime) => mountSharedDays(root, runtime),
      explore: (root) => exploreSharedDays(root, model),
    };
  },
};
