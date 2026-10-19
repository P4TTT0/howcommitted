import type { SceneRuntime } from "@/features/sequencer/types";
import { cumulativeAt } from "@/playback/aggregate";
import type { PlaybackClock } from "@/playback/clock";
import { semitonesForDegree } from "@/playback/pitch";
import type { SoundEngine } from "@/playback/sound/engine";
import {
  DRAW_SECONDS,
  growthSlots,
  indexAtProgress,
  type Race,
  yearMarks,
} from "./race";
import { createReadout } from "./readout";

/**
 * Wires the race to the sequencer's clock: bars, year and date are a pure
 * function of clock time, repainted per frame; sound is scheduled on the
 * Transport. The race always plays on calendar years; the same-age axis is an
 * explore-phase choice. Returns the cleanup.
 */
export function mountVersusRace(
  root: HTMLElement,
  race: Race,
  { clock, sound }: SceneRuntime,
): () => void {
  // Everything that can throw first, sound last.
  const readout = createReadout(root, race);
  const stopRendering = clock.onFrame((seconds) => {
    const progress = Math.min(1, seconds / DRAW_SECONDS);
    readout.show(
      race.lanes.map((lane) => cumulativeAt(lane.series, progress)),
      indexAtProgress(race, progress),
      progress,
    );
  });
  scheduleSound(clock, sound, race);
  return stopRendering;
}

function scheduleSound(
  clock: PlaybackClock,
  getEngine: () => SoundEngine | null,
  race: Race,
) {
  // One aggregated hit per growing lane on each beat; each developer keeps
  // their own pitch, so lanes can be told apart by ear.
  for (const slot of growthSlots(race)) {
    for (const lane of slot.lanes) {
      const semitones = semitonesForDegree(lane * 2);
      clock.at(slot.time, (time) =>
        getEngine()?.playTick({ time, semitones, intensity: 1 }),
      );
    }
  }
  for (const mark of yearMarks(race).slice(1)) {
    clock.at(mark.startProgress * DRAW_SECONDS, (time) =>
      getEngine()?.playAccent(time),
    );
  }
  clock.at(DRAW_SECONDS, (time) =>
    getEngine()?.playPayoff({ time, kind: "final" }),
  );
}
