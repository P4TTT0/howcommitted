import { TOTAL_SECONDS } from "@/features/sequencer/model/plan";
import type { SceneDefinition } from "@/features/sequencer/types";
import { exploreVersusRace } from "./explore";
import { mountVersusRace } from "./mount";
import { RaceView } from "./RaceView";
import { BPM, buildRaces } from "./race";

/**
 * Versus scene 2: the cumulative contributions of every developer as bars on
 * one shared timeline, ordered by the running total at each moment so places
 * swap as the years go by, with the lines crossed so far. There is no ranking
 * number, no leader and no verdict. Explore adds a toggle between calendar
 * years and same age (years since each one's first contribution year).
 */
export const versusRaceScene: SceneDefinition = {
  id: "versus-race",
  label: "Contribution race",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const races = buildRaces(
      versus.map(({ login, model }) => ({ login, plan: model.plan })),
    );
    if (!races) return null;
    return {
      duration: TOTAL_SECONDS,
      bpm: BPM,
      view: <RaceView race={races.calendar} />,
      mount: (root, runtime) => mountVersusRace(root, races.calendar, runtime),
      explore: (root) => exploreVersusRace(root, races),
    };
  },
};
