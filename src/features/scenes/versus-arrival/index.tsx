import type { SceneDefinition } from "@/features/sequencer/types";
import { ArrivalView } from "./ArrivalView";
import { mountVersusArrival } from "./mount";
import { BPM, buildArrival } from "./plan";

/**
 * Versus scene 1: the opening. Every developer on one time axis, from the day
 * their account was created, through the wait for a first contribution, to
 * today. Plain statements only; nobody is ranked. It has no explore phase: the
 * finished scene is the whole point.
 */
export const versusArrivalScene: SceneDefinition = {
  id: "versus-arrival",
  label: "Arrival",
  create({ versus }) {
    if (!versus || versus.length < 2) return null;
    const arrival = buildArrival(versus);
    if (!arrival) return null;
    return {
      duration: arrival.duration,
      bpm: BPM,
      view: <ArrivalView arrival={arrival} />,
      mount: (root, runtime) => mountVersusArrival(root, arrival, runtime),
    };
  },
};
