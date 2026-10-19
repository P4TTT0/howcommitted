/**
 * Sound engine: pitched Kenney casino chips (CC0, see
 * public/sounds/CREDITS.md), never synths.
 *
 * Hits arrive pre-aggregated and pre-quantized from the schedule; this module
 * only decides how each one sounds.
 *
 * - Ticks: a chip sample shifted up the scale by the semitone offset the
 *   caller computed, with small random pitch and volume variation.
 * - Payoff: a thud and a rattle, both pitched down and layered; the final one
 *   drops lower and louder.
 * - Year accent: the thud, pitched down, quiet.
 * - Voice limit: each group caps simultaneous voices; past it the oldest is
 *   cut.
 * - Speed: samples are never resampled for speed (that would pitch-shift the
 *   chips off the scale). Ticks only arrive sooner; above 1x they also get a
 *   little quieter, because twice the hits per second read as louder.
 */

import * as Tone from "tone";
import {
  microVariation,
  rateForCents,
  rateForSemitones,
  tickDbForSpeed,
} from "../pitch";
import {
  acceptPop,
  countRate,
  countTicks,
  fillTicks,
  stairSemitones,
} from "./gestures";
import { disposePools, loadSamples, type Pool, playSample } from "./samples";

const TICK_FILES = ["chip-1", "chip-2", "chip-3"] as const;
const PAYOFF_FILES = ["payoff-thud", "payoff-rattle"] as const;

const GESTURE_FILES = [
  "pop",
  "fill-tick",
  "stair",
  "count-tick",
  "count-close",
] as const;

const TICK_VOICE_LIMIT = 6;
const POP_VOICE_LIMIT = 4;
const FILL_VOICE_LIMIT = 4;
const STAIR_VOICE_LIMIT = 4;
const COUNT_VOICE_LIMIT = 4;
const POP_DB = -10;
const FILL_DB = -14;
const STAIR_DB = -8;
const COUNT_TICK_DB = -14;
const COUNT_CLOSE_DB = -8;
const PAYOFF_VOICE_LIMIT = 4;
const ACCENT_VOICE_LIMIT = 2;
const MARKER_VOICE_LIMIT = 2;
/** Tick pitch offset so the climb starts a little below the sample root. */
const TICK_BASE_SEMITONES = -4;
const TICK_BASE_DB = -9;
const PAYOFF_BASE_DB = -2;
const ACCENT = { semitones: -5, db: -11 };
/** Softer and higher than a payoff, so it reads as a different kind of event. */
const UNATTRIBUTED = { semitones: 3, db: -8 };
const LIMITER_DB = -1;
export type TickHit = {
  /** Audio time from the Transport callback. */
  time: number;
  /** Semitones above the run's root. */
  semitones: number;
  /** 0..1 */
  intensity: number;
};

export type PayoffHit = {
  time: number;
  kind: "step" | "final";
};

export class SoundEngine {
  private readonly limiter: Tone.Limiter;
  private readonly pools = {
    tick: [] as Pool,
    payoff: [] as Pool,
    accent: [] as Pool,
    marker: [] as Pool,
    pop: [] as Pool,
    fill: [] as Pool,
    stair: [] as Pool,
    count: [] as Pool,
  };
  private lastPop = Number.NEGATIVE_INFINITY;
  private lastTick = -1;
  private tickSpeedDb = 0;

  private constructor(
    private readonly buffers: Tone.ToneAudioBuffers,
    private readonly random: () => number,
  ) {
    this.limiter = new Tone.Limiter(LIMITER_DB).toDestination();
  }

  /** Loads the samples. Rejects if any file fails to load. */
  static async load(random: () => number = Math.random): Promise<SoundEngine> {
    const buffers = await loadSamples([
      ...TICK_FILES,
      ...PAYOFF_FILES,
      ...GESTURE_FILES,
    ]);
    return new SoundEngine(buffers, random);
  }

  setMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
  }

  /** Follows the playback rate; only the density of ticks is adjusted. */
  setSpeed(speed: number): void {
    this.tickSpeedDb = tickDbForSpeed(speed);
  }

  playTick({ time, semitones, intensity }: TickHit): void {
    const variation = microVariation(this.random);
    playSample(
      this.pools.tick,
      TICK_VOICE_LIMIT,
      this.limiter,
      this.buffers.get(this.pickTick()),
      {
        time,
        rate:
          rateForSemitones(TICK_BASE_SEMITONES + semitones) *
          rateForCents(variation.cents),
        db:
          TICK_BASE_DB + (intensity - 1) * 6 + variation.db + this.tickSpeedDb,
      },
    );
  }

  playPayoff({ time, kind }: PayoffHit): void {
    const final = kind === "final";
    const variation = microVariation(this.random, { cents: 20, db: 1 });
    // A low thud with a rattle on top; the final one drops lower and louder.
    const layers = [
      { file: PAYOFF_FILES[0], semitones: -9, db: 0 },
      { file: PAYOFF_FILES[1], semitones: -4, db: -3 },
    ];
    for (const { file, semitones, db } of layers) {
      playSample(
        this.pools.payoff,
        PAYOFF_VOICE_LIMIT,
        this.limiter,
        this.buffers.get(file),
        {
          time,
          rate:
            rateForSemitones(semitones - (final ? 5 : 0)) *
            rateForCents(variation.cents),
          db: PAYOFF_BASE_DB + db + (final ? 3 : 0) + variation.db,
        },
      );
    }
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
        db: POP_DB + db + (this.random() * 2 - 1),
      },
    );
  }

  /**
   * Gesture: a bar loads. Schedules its own ticks, accelerating (about 110ms
   * to 30ms) and rising (rate 0.8 to 1.7) over `duration`, then silence.
   */
  fill(
    startTime: number,
    duration: number,
    { db = 0 }: { db?: number } = {},
  ): void {
    for (const { offset, rate } of fillTicks(duration)) {
      playSample(
        this.pools.fill,
        FILL_VOICE_LIMIT,
        this.limiter,
        this.buffers.get("fill-tick"),
        { time: startTime + offset, rate, db: FILL_DB + db },
      );
    }
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
      { time, rate: countRate(progress), db: COUNT_TICK_DB },
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
   * Gesture: a number climbs over `duration` in `steps` ticks, then settles
   * with one closing hit at `startTime + duration`.
   */
  count(startTime: number, duration: number, steps: number): void {
    for (const { offset, progress } of countTicks(duration, steps)) {
      this.countTick(startTime + offset, progress);
    }
    this.countClose(startTime + Math.max(0, duration));
  }

  /** Gesture: a milestone ("@a passes @b"). Heavy and rare. */
  payoff(time: number): void {
    this.playPayoff({ time, kind: "step" });
  }

  /** A soft marker so a year change is heard, not just seen. */
  playAccent(time: number): void {
    playSample(
      this.pools.accent,
      ACCENT_VOICE_LIMIT,
      this.limiter,
      this.buffers.get(PAYOFF_FILES[0]),
      { time, rate: rateForSemitones(ACCENT.semitones), db: ACCENT.db },
    );
  }

  /** The step for commits not attributed to a day: one soft, distinct thud. */
  playUnattributed(time: number): void {
    playSample(
      this.pools.marker,
      MARKER_VOICE_LIMIT,
      this.limiter,
      this.buffers.get(PAYOFF_FILES[0]),
      {
        time,
        rate: rateForSemitones(UNATTRIBUTED.semitones),
        db: UNATTRIBUTED.db,
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

  /** Random chip sample that never repeats the previous one. */
  private pickTick(): string {
    let index = Math.floor(this.random() * TICK_FILES.length);
    if (index === this.lastTick) index = (index + 1) % TICK_FILES.length;
    this.lastTick = index;
    return TICK_FILES[index] ?? TICK_FILES[0];
  }
}
