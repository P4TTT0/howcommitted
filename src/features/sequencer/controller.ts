import type { PlaybackClock } from "@/playback/clock";
import type { SoundEngine } from "@/playback/sound/engine";
import type { SequencedScene } from "./sequence";
import type { SceneRuntime } from "./types";

/**
 * Where the sequence is. A new object on every change, so it works as a
 * dependency.
 *
 * - `mode "playing"`: the clock is driving the scene.
 * - `mode "explore"`: the scene sits in its final state and the user looks
 *   closer; nothing advances on its own. Also the mode of the finale.
 */
export type SequenceState = {
  index: number;
  /** Bumped by a full replay (from the first scene). */
  run: number;
  /** Bumped whenever a scene is (re)mounted: the stage's key and effect dependency. */
  visit: number;
  /** On the finale, after the last scene. No scene is mounted then. */
  done: boolean;
  mode: "playing" | "explore";
};

export const INITIAL_STATE: SequenceState = {
  index: 0,
  run: 0,
  visit: 0,
  done: false,
  mode: "playing",
};

type Env = {
  sound: () => SoundEngine | null;
  reducedMotion: boolean;
};

/**
 * The React-free half of the sequencer: which scene is mounted and in which
 * phase, how the user moves between scenes, and how the sequence restarts or
 * is cancelled. The clock, the sound engine and the stage element belong to
 * the caller.
 *
 * A scene that finishes HOLDS in explore: the controller never advances by
 * itself. Moving is always the user's call (`next`, `prev`, `goTo`).
 */
export class SequenceController {
  state: SequenceState = INITIAL_STATE;
  private cleanup: (() => void) | null = null;
  private exploreCleanup: (() => void) | null = null;
  private root: HTMLElement | null = null;
  /** Scenes the user has seen play out (or left): they reopen in explore. */
  private readonly played = new Set<number>();
  private speed = 1;
  private cancelled = false;

  constructor(
    private readonly sequence: readonly SequencedScene[],
    private readonly clock: PlaybackClock,
    private readonly env: Env,
    private readonly onChange: (state: SequenceState) => void,
  ) {}

  get sceneCount(): number {
    return this.sequence.length;
  }

  /** True when `index` was played (or left), so it reopens in explore. */
  hasPlayed(index: number): boolean {
    return this.played.has(index);
  }

  /** The playback speed in effect (1 = as authored). */
  get playbackSpeed(): number {
    return this.speed;
  }

  /**
   * Plays faster or slower, sound and visuals together, for this scene and
   * every scene after it.
   */
  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) return;
    this.speed = speed;
    this.clock.setSpeed(speed);
    this.env.sound()?.setSpeed(speed);
  }

  /** The playing scene ran out: hold on its final state and open explore. */
  finishScene(): void {
    if (this.cancelled) return;
    const { index, done, mode } = this.state;
    if (done || mode !== "playing") return;
    this.played.add(index);
    this.set({ ...this.state, mode: "explore" });
    this.enterExplore();
  }

  /** Next scene, or the finale after the last one. No-op on the finale. */
  next(): void {
    if (this.state.done) return;
    this.goTo(this.state.index + 1);
  }

  /** Previous scene; from the finale, the last scene. No-op on the first. */
  prev(): void {
    this.goTo(
      this.state.done ? this.sequence.length - 1 : this.state.index - 1,
    );
  }

  /**
   * Jumps to a scene (an index at or past the end means the finale). A scene
   * already played lands in explore, a new one plays. Leaving a scene counts
   * it as played, even if it was cut short.
   */
  goTo(index: number): void {
    if (this.cancelled || this.sequence.length === 0) return;
    const target = Math.max(0, Math.min(index, this.sequence.length));
    const { done } = this.state;
    if (target === this.state.index && !done && target < this.sequence.length) {
      return;
    }
    if (target === this.sequence.length && done) return;
    if (!done) this.played.add(this.state.index);
    const visit = this.state.visit + 1;
    if (target >= this.sequence.length) {
      this.set({
        ...this.state,
        index: this.sequence.length - 1,
        visit,
        done: true,
        mode: "explore",
      });
      return;
    }
    this.set({
      ...this.state,
      index: target,
      visit,
      done: false,
      mode: this.played.has(target) ? "explore" : "playing",
    });
  }

  /** Plays the current scene again from its start, with sound. */
  replayScene(): void {
    if (this.cancelled || this.state.done) return;
    this.set({
      ...this.state,
      visit: this.state.visit + 1,
      mode: "playing",
    });
  }

  /** Starts over from the first scene (everything plays again). */
  replay(): void {
    if (this.cancelled) return;
    this.played.clear();
    this.set({
      index: 0,
      run: this.state.run + 1,
      visit: this.state.visit + 1,
      done: false,
      mode: "playing",
    });
  }

  /**
   * Stops everything for good: the scene is unmounted, the clock disposed and
   * every later command ignored. The caller then leaves the experience.
   */
  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.unmount();
    this.clock.dispose();
  }

  /**
   * Mounts the scene of `state` on the shared clock. Playing starts it; explore
   * wires it the same way, then puts the clock at the end without sound and
   * opens explore. A scene whose `mount` throws is logged (in development),
   * dropped, and the sequence moves on: one broken scene never takes the
   * experience down.
   */
  mount(root: HTMLElement, state: SequenceState): void {
    const scene = this.sequence[state.index];
    if (!scene || state.done || this.cancelled) return;
    this.root = root;
    const { duration, bpm } = scene.instance;
    this.clock.loadScene({ duration, bpm });
    try {
      this.cleanup = scene.instance.mount(root, this.runtime());
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Scene "${scene.id}" failed to mount`, error);
      }
      // Hits it scheduled before throwing are dropped by the next load.
      this.clock.loadScene({ duration, bpm });
      this.played.add(state.index);
      this.goTo(state.index + 1);
      return;
    }
    if (state.mode === "explore") {
      this.clock.jumpToEnd();
      this.enterExplore();
    } else {
      this.clock.start();
    }
  }

  unmount(): void {
    this.exploreCleanup?.();
    this.exploreCleanup = null;
    this.cleanup?.();
    this.cleanup = null;
    this.root = null;
  }

  private runtime(): SceneRuntime {
    return {
      clock: this.clock,
      sound: this.env.sound,
      reducedMotion: this.env.reducedMotion,
    };
  }

  /** Makes the mounted scene interactive. A failing explore leaves it static. */
  private enterExplore(): void {
    const scene = this.sequence[this.state.index];
    const root = this.root;
    if (!scene?.instance.explore || !root) return;
    try {
      this.exploreCleanup = scene.instance.explore(root, this.runtime());
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Scene "${scene.id}" failed to explore`, error);
      }
    }
  }

  private set(next: SequenceState): void {
    this.state = next;
    this.onChange(next);
  }
}
