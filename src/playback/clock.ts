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
 * Scene time is measured in Transport *ticks*, not in Transport seconds, so
 * speed can change without moving anything on the scene's timeline. Hits are
 * scheduled at `seconds * ticksPerSecond` (ticks at the scene's own tempo),
 * and the Transport tempo is `bpm * speed`. Playing at 2x therefore advances
 * ticks twice as fast: scheduled sound and the per-frame visual time (ticks
 * back to scene seconds) stay locked together at any speed, and a speed change
 * mid-scene only changes how fast the same timeline is walked. Samples are
 * never resampled for speed: they keep their pitch and only arrive sooner.
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
  /** Tempo of the loaded scene: the unit its hits and duration are expressed in. */
  private bpm: number;
  /** Playback rate; 1 is the scene as authored. Survives `loadScene`. */
  private rate = 1;
  private readonly frameListeners = new Set<FrameListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private current: ClockStatus = "idle";
  /** Hidden tabs stop rAF; pause instead of letting the scene run unseen. */
  private readonly onVisibility = () => {
    if (document.hidden) this.pause();
  };
  private frameHandle = 0;
  /** A skip while paused: the next `start()` begins paused too. */
  private holdPaused = false;

  constructor({ duration, bpm }: ClockOptions) {
    this.duration = duration;
    this.bpm = bpm;
    const transport = Tone.getTransport();
    transport.cancel();
    transport.stop();
    this.applyTempo();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  get status(): ClockStatus {
    return this.current;
  }

  /** Playback rate in effect (1 = as authored). */
  get speed(): number {
    return this.rate;
  }

  /** Transport ticks that make up one second of the loaded scene. */
  private get ticksPerSecond(): number {
    return (Tone.getTransport().PPQ * this.bpm) / 60;
  }

  /** Scene seconds the Transport has reached (not corrected for look-ahead). */
  private get sceneSeconds(): number {
    return Tone.getTransport().ticks / this.ticksPerSecond;
  }

  /** Scene seconds as seen and heard right now. */
  get seconds(): number {
    const heard = this.sceneSeconds - Tone.getContext().lookAhead * this.rate;
    return Math.min(this.duration, Math.max(0, heard));
  }

  /**
   * Plays the scene faster or slower, sound and visuals together, from now on
   * and for every scene loaded after this one. Safe at any time, including
   * while paused or ended.
   */
  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) return;
    this.rate = speed;
    this.applyTempo();
  }

  private applyTempo(): void {
    Tone.getTransport().bpm.value = this.bpm * this.rate;
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
    this.bpm = bpm;
    this.applyTempo();
    this.duration = duration;
    this.setStatus("idle");
  }

  /** Resumes the AudioContext. Call from a user gesture. */
  async unlock(): Promise<void> {
    await Tone.start();
  }

  /**
   * Runs `callback` when the clock reaches `seconds` of the scene, with the
   * audio time. Scheduled in ticks, so it keeps its place when speed changes.
   */
  at(seconds: number, callback: (audioTime: number) => void): void {
    const ticks = Math.round(seconds * this.ticksPerSecond);
    Tone.getTransport().schedule(callback, `${ticks}i`);
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
    const hold = this.holdPaused;
    this.holdPaused = false;
    this.setStatus("playing");
    Tone.getTransport().start();
    this.runFrames();
    if (hold) this.pause();
  }

  /** Forgets a pending hold, so the next `start()` plays (used by replay). */
  resetHold(): void {
    this.holdPaused = false;
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
    this.holdPaused = false;
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

  /**
   * Puts the loaded scene straight at its end state without playing it: no
   * sound, one exact last frame, status `ended`. Used to land on a scene that
   * was already played.
   */
  jumpToEnd(): void {
    cancelAnimationFrame(this.frameHandle);
    this.holdPaused = false;
    this.finish();
  }

  /** Jumps to the end state. Hits not yet played are dropped. */
  skip(): void {
    if (this.current !== "playing" && this.current !== "paused") return;
    // Skipping while paused keeps the pause: the next scene loads paused.
    this.holdPaused = this.current === "paused";
    this.finish();
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
      if (this.sceneSeconds >= this.duration) {
        this.finish();
        return;
      }
      this.emitFrame();
      this.frameHandle = requestAnimationFrame(tick);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }
}
