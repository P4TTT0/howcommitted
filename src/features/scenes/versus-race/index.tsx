import { TOTAL_SECONDS } from "@/features/sequencer/model/plan";
import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreVersusRace } from "./explore";
import { mountVersusRace } from "./mount";
import { RaceView } from "./RaceView";
import { BPM, buildRace } from "./race";

/**
 * Versus scene 1: the cumulative contributions of every developer as bars that
 * grow with the years, each with their GitHub picture at the tip. The scale
 * follows whoever is ahead, rows slide into their new places when the order
 * changes and a black chip names each pass. There is no ranking number, no
 * verdict. Explore lets the viewer jump to any year.
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
