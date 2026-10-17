import type { ReactNode } from "react";
import type { History } from "@/domain/history";
import type { HistoryPlan } from "@/features/timeline/historyPlan";
import type { PlaybackClock } from "@/playback/clock";
import type { SoundEngine } from "@/playback/sound/engine";

/**
 * The scene contract. The sequencer plays an ordered list of
 * `SceneDefinition`s on the single clock from `src/playback`, then shows the
 * finale. A scene never owns a clock, a start button, controls or a progress
 * bar: it declares markup and, once that markup is in the DOM, wires sound and
 * motion to the clock it is handed. Entries are registered in
 * `src/features/scenes/registry.ts`; see docs/architecture.md.
 */

/** Everything a scene may read. Scenes never fetch. */
export type SceneData = {
  login: string;
  /** Calendar-derived plan, yearly totals, notes and the private share. */
  model: HistoryPlan;
  /** The full payload for scenes that need more than the plan; null in the lab. */
  history: History | null;
};

/** What the sequencer hands a scene when it mounts. */
export type SceneRuntime = {
  /** Already loaded with this scene's duration and tempo; starts right after `mount`. */
  clock: PlaybackClock;
  /** The shared sound engine; null while unavailable (samples failed) or never. */
  sound: () => SoundEngine | null;
  reducedMotion: boolean;
};

/** One scene, built for one profile. */
export type SceneInstance = {
  /** Seconds on the clock; the sequencer advances when it elapses. */
  duration: number;
  bpm: number;
  /**
   * Static markup. It fills the stage (`absolute inset-0` inside a positioned
   * box: the area above the controls). It must render its final state
   * correctly without JavaScript timing, and carry its own accessible name.
   */
  view: ReactNode;
  /**
   * Called once `view` is in the DOM. Schedule sound with `clock.at`, drive
   * motion with `clock.onFrame` or `clock.drive`, and return a cleanup that
   * undoes all of it. Never start your own timers or animation loops.
   */
  mount(root: HTMLElement, runtime: SceneRuntime): () => void;
};

export type SceneDefinition = {
  /** Stable id: used by the lab (`/lab?scene=<id>`) and as the React key. */
  id: string;
  /** Shown to assistive tech in the progress bar ("Scene 2 of 5: ..."). */
  label: string;
  /** Null when the data has nothing for this scene: it is skipped. */
  create(data: SceneData): SceneInstance | null;
};

/** What follows the last scene (the final poster). Replaceable on its own. */
export type FinaleDefinition = {
  render(data: SceneData, actions: { replay(): void }): ReactNode;
};
