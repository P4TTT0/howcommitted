/**
 * Sound engine: curated Kenney samples (CC0, see public/sounds/CREDITS.md),
 * never synths. Scenes call one gesture per kind of motion on screen, on the
 * clock grid (see docs/design.md, Sound):
 *
 * - pop: a small block appears.
 * - fill: a bar loads (ticks scheduled by `scheduleFill`).
 * - stair: the next item in a sequence appears, low to high.
 * - count: a number climbs, then settles (`scheduleCount`).
 * - payoff: a milestone or a pass, heavy and rare.
 *
 * Each gesture caps its simultaneous voices; past the cap the oldest is cut.
 * Hover and click are not here: they live on the interaction channel.
 */

import * as Tone from "tone";
import { rateForSemitones, tickDbForSpeed } from "../pitch";
import { acceptPop, countRate, stairSemitones } from "./gestures";
import {
  disposePools,
  loadSamples,
  type Pool,
  playSample,
  stopPools,
} from "./samples";

const FILES = [
  "pop",
  "fill-tick",
  "stair",
  "count-tick",
  "count-close",
  "payoff-rattle",
] as const;

const POP_VOICE_LIMIT = 4;
const FILL_VOICE_LIMIT = 4;
const STAIR_VOICE_LIMIT = 4;
const COUNT_VOICE_LIMIT = 4;
const PAYOFF_VOICE_LIMIT = 4;
const POP_DB = -10;
const FILL_DB = -14;
const STAIR_DB = -8;
const COUNT_TICK_DB = -14;
const COUNT_CLOSE_DB = -8;
/** The rattle pitched down a little so it lands heavier than the gestures. */
const PAYOFF = { semitones: -4, db: -3 };
const LIMITER_DB = -1;

export class SoundEngine {
  private readonly limiter: Tone.Limiter;
  private readonly pools = {
    pop: [] as Pool,
    fill: [] as Pool,
    stair: [] as Pool,
    count: [] as Pool,
    payoff: [] as Pool,
  };
  private lastPop = Number.NEGATIVE_INFINITY;
  /** Quieter repeats above 1x: more hits per second read as louder. */
  private speedDb = 0;

  private constructor(
    private readonly buffers: Tone.ToneAudioBuffers,
    private readonly random: () => number,
  ) {
    this.limiter = new Tone.Limiter(LIMITER_DB).toDestination();
  }

  /** Loads the samples. Rejects if any file fails to load. */
  static async load(random: () => number = Math.random): Promise<SoundEngine> {
    return new SoundEngine(await loadSamples(FILES), random);
  }

  setMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
  }

  /** Follows the playback rate; samples are never resampled for speed. */
  setSpeed(speed: number): void {
    this.speedDb = tickDbForSpeed(speed);
  }

  /**
   * Gesture: a small block appears. One per block on the beat, with slight
   * random pitch (about +-10%). Pops landing in the same grid slot as the
   * previous one are dropped and concurrent voices are capped, so a scene
   * that draws hundreds of blocks never machine-guns.
   */
  pop(time: number, { db = 0 }: { db?: number } = {}): void {
    if (!acceptPop(time, this.lastPop)) return;
    this.lastPop = time;
    playSample(
      this.pools.pop,
      POP_VOICE_LIMIT,
      this.limiter,
      this.buffers.get("pop"),
      {
        time,
        rate: 1 + (this.random() * 2 - 1) * 0.1,
        db: POP_DB + db + this.speedDb + (this.random() * 2 - 1),
      },
    );
  }

  /**
   * Gesture: one tick of a loading bar. A bar is many of these, each scheduled
   * on the clock by `scheduleFill`, so pause, resume and seek hold them.
   */
  fillTick(time: number, rate: number, db = 0): void {
    playSample(
      this.pools.fill,
      FILL_VOICE_LIMIT,
      this.limiter,
      this.buffers.get("fill-tick"),
      { time, rate, db: FILL_DB + db + this.speedDb },
    );
  }

  /** Gesture: step `index` (0-based) of a sequence, low to high, pentatonic. */
  stair(time: number, index: number): void {
    playSample(
      this.pools.stair,
      STAIR_VOICE_LIMIT,
      this.limiter,
      this.buffers.get("stair"),
      {
        time,
        rate: rateForSemitones(stairSemitones(index)),
        db: STAIR_DB,
      },
    );
  }

  /** Gesture: one tick of a climbing number; `progress` is 0..1. */
  countTick(time: number, progress: number): void {
    playSample(
      this.pools.count,
      COUNT_VOICE_LIMIT,
      this.limiter,
      this.buffers.get("count-tick"),
      { time, rate: countRate(progress), db: COUNT_TICK_DB + this.speedDb },
    );
  }

  /** Gesture: the closing hit when a number settles. */
  countClose(time: number): void {
    playSample(
      this.pools.count,
      COUNT_VOICE_LIMIT,
      this.limiter,
      this.buffers.get("count-close"),
      { time, rate: 1, db: COUNT_CLOSE_DB },
    );
  }

  /**
   * Stops every voice in every pool now, with the short fade used for cuts.
   * Called when the clock pauses or is cancelled so nothing rings into it.
   */
  silence(): void {
    stopPools(this.pools, Tone.now());
  }

  /** Gesture: a milestone ("@a passes @b"). Heavy and rare. */
  payoff(time: number): void {
    playSample(
      this.pools.payoff,
      PAYOFF_VOICE_LIMIT,
      this.limiter,
      this.buffers.get("payoff-rattle"),
      {
        time,
        rate: rateForSemitones(PAYOFF.semitones),
        db: PAYOFF.db + (this.random() * 2 - 1),
      },
    );
  }

  /** Disposes the engine and clears the global mute for the next one. */
  dispose(): void {
    disposePools(this.pools);
    this.limiter.dispose();
    this.buffers.dispose();
    Tone.getDestination().mute = false;
  }
}
