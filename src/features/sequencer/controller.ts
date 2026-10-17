import type { PlaybackClock } from "@/playback/clock";
import type { SoundEngine } from "@/playback/sound/engine";
import type { SequencedScene } from "./sequence";

/** Where the sequence is. A new object on every change, so it works as a dependency. */
export type SequenceState = { index: number; run: number; done: boolean };

type Env = {
  sound: () => SoundEngine | null;
  reducedMotion: boolean;
};

/**
 * The React-free half of the sequencer: which scene is mounted, how a scene
 * ends or fails, and how the sequence restarts. The clock, the sound engine
 * and the stage element belong to the caller.
 */
export class SequenceController {
  state: SequenceState = { index: 0, run: 0, done: false };
  private cleanup: (() => void) | null = null;

  constructor(
    private readonly sequence: readonly SequencedScene[],
    private readonly clock: PlaybackClock,
    private readonly env: Env,
    private readonly onChange: (state: SequenceState) => void,
  ) {}

  /** The current scene ran out or was skipped: next scene, or the finale. */
  advance(): void {
    const { index, run } = this.state;
    this.set(
      index < this.sequence.length - 1
        ? { index: index + 1, run, done: false }
        : { index, run, done: true },
    );
  }

  /** Starts over from the first scene (playing, not held paused). */
  replay(): void {
    this.clock.resetHold();
    this.set({ index: 0, run: this.state.run + 1, done: false });
  }

  /**
   * Mounts the scene of `state` on the shared clock and starts it. A scene
   * whose `mount` throws is logged (in development), dropped, and the
   * sequence moves on: one broken scene never takes the experience down.
   */
  mount(root: HTMLElement, state: SequenceState): void {
    const scene = this.sequence[state.index];
    if (!scene) return;
    const { duration, bpm } = scene.instance;
    this.clock.loadScene({ duration, bpm });
    try {
      this.cleanup = scene.instance.mount(root, {
        clock: this.clock,
        sound: this.env.sound,
        reducedMotion: this.env.reducedMotion,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`Scene "${scene.id}" failed to mount`, error);
      }
      // Hits it scheduled before throwing are dropped by the next load.
      this.clock.loadScene({ duration, bpm });
      this.advance();
      return;
    }
    this.clock.start();
  }

  unmount(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  private set(next: SequenceState): void {
    this.state = next;
    this.onChange(next);
  }
}
