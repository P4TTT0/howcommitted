import type { ReactNode } from "react";
import type { History } from "@/domain/history";
import type { HistoryPlan } from "@/features/sequencer/model/historyPlan";
import type { PlaybackClock } from "@/playback/clock";
import type { SoundEngine } from "@/playback/sound/engine";

/**
 * The scene contract. The sequencer runs an ordered list of
 * `SceneDefinition`s on the single clock from `src/playback`, then shows the
 * finale. A scene never owns a clock, a start button, controls or a progress
 * bar: it declares markup and, once that markup is in the DOM, wires sound and
 * motion to the clock it is handed. Entries are registered in
 * `src/features/scenes/registry.ts`; see docs/architecture.md.
 *
 * A scene has two phases:
 *
 * - Playing: `mount` runs and the clock drives sound and motion from 0 to the
 *   scene's `duration`.
 * - Explore: the scene sits in its final state and the user looks closer. It
 *   starts when the clock ends and the sequencer HOLDS here: it never moves on
 *   by itself. It is also where the user lands when they go back to (or jump
 *   to) a scene they already played. There `mount` still runs first, so the
 *   scene is wired exactly as when playing, and the clock is put at the end
 *   without sound. Then `explore` runs.
 *
 * Replay is always a fresh `mount` in the playing phase.
 */

/** One developer in a versus run. */
export type VersusEntry = {
  login: string;
  model: HistoryPlan;
  /** ISO timestamp the account was created; absent when unknown. */
  joinedAt?: string;
};

/** Everything a scene may read. Scenes never fetch. */
export type SceneData = {
  login: string;
  /** Calendar-derived plan, yearly totals, notes and the private share. */
  model: HistoryPlan;
  /** The full payload for scenes that need more than the plan; null in the lab. */
  history: History | null;
  /**
   * Versus only: every developer in the order they were added (2 to 5). The
   * fields above then describe the first one. Solo scenes ignore this; the
   * versus scenes and finale read it and are skipped without it.
   */
  versus?: readonly VersusEntry[];
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
  /**
   * Optional. Called in the explore phase, after `mount`, with the scene
   * already at its final state. Make the chart interactive here: pointer
   * (mouse, touch, pen) and keyboard, with every exact value readable by
   * assistive tech (a focusable element with `aria-valuetext`, or similar).
   * Return a cleanup that restores whatever it changed.
   *
   * Rules: no sound (the sequencer keeps explore silent; sound only returns on
   * a replay); no timers or animation loops of your own; pointer readouts are
   * instantaneous DOM updates, anything that moves over time goes through the
   * clock. Arrow keys on a focused chart should call `stopPropagation`, since
   * the same keys otherwise change scene. A scene without `explore` simply
   * shows its final state.
   */
  explore?(root: HTMLElement, runtime: SceneRuntime): () => void;
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
