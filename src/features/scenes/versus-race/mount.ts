import type { SceneRuntime } from "@/features/sequencer/types";
import { cumulativeAt } from "@/playback/aggregate";
import type { PlaybackClock } from "@/playback/clock";
import type { SoundEngine } from "@/playback/sound/engine";
import {
  DRAW_SECONDS,
  fillSegments,
  indexAtProgress,
  passTimes,
  playbackPassDays,
  type Race,
} from "./race";
import { createReadout } from "./readout";

/**
 * Wires the race to the sequencer's clock: bars, year and date are a pure
 * function of clock time, repainted per frame; sound is scheduled on the
 * Transport. Clock progress maps to a point on the daily axis, so values
 * interpolate within a day and a pass shows at the moment the lines cross; no
 * timer of its own. Returns the cleanup.
 */
export function mountVersusRace(
  root: HTMLElement,
  race: Race,
  { clock, sound }: SceneRuntime,
): () => void {
  // Everything that can throw first, sound last.
  const readout = createReadout(root, race, playbackPassDays(race));
  const stopRendering = clock.onFrame((seconds) => {
    const progress = Math.min(1, seconds / DRAW_SECONDS);
    readout.show(
      race.lanes.map((lane) => cumulativeAt(lane.series, progress)),
      indexAtProgress(race, progress),
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
  // One climb tied to the leader's total, played year by year as segments.
  for (const { start, duration, from, to } of fillSegments(race)) {
    clock.at(start, (time) => getEngine()?.fill(time, duration, { from, to }));
  }
  // The payoff lands as the "@a passes @b" chip appears.
  for (const time of passTimes(race)) {
    clock.at(time, (at) => getEngine()?.payoff(at));
  }
}
