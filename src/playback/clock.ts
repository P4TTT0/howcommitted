/**
 * The single clock.
 *
 * Tone.js `Transport` is the only source of time. Nothing else keeps a
 * clock of its own:
 *
 * - Sound: hits are scheduled on the Transport (`at`), so they land on the
 *   audio hardware's sample-accurate timeline, quantized by the caller.
 * - Visuals: one requestAnimationFrame loop reads the Transport position
 *   and pushes it to every subscriber (`onFrame`) and to GSAP timelines
 *   (`drive`). Timelines are created paused and are only ever *seeked* to
 *   that position, so they cannot drift from the audio: pause, resume and
 *   replay are all just Transport state.
 *
 * The Transport position runs `lookAhead` seconds ahead of what the speakers
 * play (Tone schedules audio slightly early). Visual time subtracts it so
 * what is drawn matches what is heard. Output latency of the device is not
 * compensated here; see the spike notes if hardware offsets show up.
 *
 * The browser's AudioContext only runs after a user gesture, so `unlock`
 * must be called from a click handler before `start`.
 */

import * as Tone from "tone";

export type ClockStatus = "idle" | "playing" | "paused" | "ended";

/** Anything that can be seeked to a time, such as a paused GSAP timeline. */
export type Seekable = {
  time(seconds: number, suppressEvents?: boolean): unknown;
};

export type ClockOptions = {
  /** Total length in seconds. The clock ends here. */
  duration: number;
  bpm: number;
};

/** Duration and tempo of one scene on the clock. */
export type ClockScene = ClockOptions;

type FrameListener = (seconds: number) => void;
type StatusListener = (status: ClockStatus) => void;

export class PlaybackClock {
  duration: number;
  private readonly frameListeners = new Set<FrameListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private current: ClockStatus = "idle";
  /** Hidden tabs stop rAF; pause instead of letting the scene run unseen. */
  private readonly onVisibility = () => {
    if (document.hidden) this.pause();
  };
  private frameHandle = 0;

  constructor({ duration, bpm }: ClockOptions) {
    this.duration = duration;
    const transport = Tone.getTransport();
    transport.cancel();
    transport.stop();
    transport.bpm.value = bpm;
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  get status(): ClockStatus {
    return this.current;
  }

  /** Seconds of playback as seen and heard right now. */
  get seconds(): number {
    const { seconds } = Tone.getTransport();
    const heard = seconds - Tone.getContext().lookAhead;
    return Math.min(this.duration, Math.max(0, heard));
  }

  /**
   * Re-arms the same clock for the next scene of a sequence: scheduled hits
   * are dropped, the Transport goes back to zero and the status to `idle`.
   * Frame subscribers stay (each scene unsubscribes its own); callers then
   * schedule the scene's hits and `start()`.
   */
  loadScene({ duration, bpm }: ClockScene): void {
    cancelAnimationFrame(this.frameHandle);
    const transport = Tone.getTransport();
    transport.cancel();
    transport.stop();
    transport.position = 0;
    transport.bpm.value = bpm;
    this.duration = duration;
    this.setStatus("idle");
  }

  /** Resumes the AudioContext. Call from a user gesture. */
  async unlock(): Promise<void> {
    await Tone.start();
  }

  /** Runs `callback` when the clock reaches `seconds`, with the audio time. */
  at(seconds: number, callback: (audioTime: number) => void): void {
    Tone.getTransport().schedule(callback, seconds);
  }

  /** Subscribes to per-frame time updates. Returns an unsubscribe function. */
  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Keeps a paused GSAP timeline seeked to the clock on every frame. */
  drive(timeline: Seekable): () => void {
    return this.onFrame((seconds) => timeline.time(seconds, true));
  }

  start(): void {
    this.setStatus("playing");
    Tone.getTransport().start();
    this.runFrames();
  }

  pause(): void {
    if (this.current !== "playing") return;
    Tone.getTransport().pause();
    this.setStatus("paused");
    this.emitFrame();
  }

  resume(): void {
    if (this.current !== "paused") return;
    this.setStatus("playing");
    Tone.getTransport().start();
    this.runFrames();
  }

  restart(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    this.emitFrame();
    this.start();
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    document.removeEventListener("visibilitychange", this.onVisibility);
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    this.frameListeners.clear();
    this.statusListeners.clear();
  }

  /** Jumps to the end state. Hits not yet played are dropped. */
  skip(): void {
    if (this.current === "playing" || this.current === "paused") this.finish();
  }

  private finish(): void {
    Tone.getTransport().pause();
    this.setStatus("ended");
    // The Transport may sit a hair before the end; make the last frame exact.
    for (const listener of this.frameListeners) listener(this.duration);
  }

  private setStatus(status: ClockStatus): void {
    this.current = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private emitFrame(): void {
    const seconds = this.seconds;
    for (const listener of this.frameListeners) listener(seconds);
  }

  private runFrames(): void {
    cancelAnimationFrame(this.frameHandle);
    const tick = () => {
      if (this.current !== "playing") return;
      // The end is detected here, on the frame loop, from raw Transport time.
      if (Tone.getTransport().seconds >= this.duration) {
        this.finish();
        return;
      }
      this.emitFrame();
      this.frameHandle = requestAnimationFrame(tick);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }
}
