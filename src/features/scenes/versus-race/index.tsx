import { TOTAL_SECONDS } from "@/features/sequencer/model/plan";
import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreVersusRace } from "./explore";
import { mountVersusRace } from "./mount";
import { RaceView } from "./RaceView";
import { BPM, buildRace } from "./race";

/**
 * Versus scene 1: the cumulative contributions of every developer as bars in
 * fixed lanes, on one shared timeline. Lanes keep the order the developers
 * were added in; there is no ranking, no leader and no rank number.
 */
export const versusRaceScene: SceneDefinition = {
  id: "versus-race",
  label: "Contribution race",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const race = buildRace(
      versus.map(({ login, model }) => ({ login, plan: model.plan })),
    );
    if (!race) return null;
    return {
      duration: TOTAL_SECONDS,
      bpm: BPM,
      view: <RaceView race={race} />,
      mount: (root, runtime) => mountVersusRace(root, race, runtime),
      explore: (root) => exploreVersusRace(root, race),
    };
  },
};
