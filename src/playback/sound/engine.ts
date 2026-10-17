/**
 * Sound engine: recorded CC0 samples (see public/sounds/CREDITS.md), never
 * synths. Hits arrive pre-aggregated and pre-quantized from the schedule;
 * this module only decides how each one sounds.
 *
 * - Pitch: playback rate from the semitone offset the caller computed.
 * - Micro-variation: tiny random pitch and volume offsets per hit.
 * - Voice limit: each kind of hit has a cap on simultaneous voices; past it
 *   the oldest voice is cut, so dense passages cannot pile up.
 * - Payoff: two low, pitched-down samples layered, louder than any tick.
 *
 * Every hit is a fresh one-shot `ToneBufferSource`. Reusing a `Player`
 * across hits breaks when a pitched-down sample is still ringing at its next
 * scheduled start (its internal state timeline must only move forward).
 */

import * as Tone from "tone";
import { microVariation, rateForCents, rateForSemitones } from "../pitch";

const BASE_URL = "/sounds/";
const TICK_FILES = ["tick-1.ogg", "tick-2.ogg", "tick-3.ogg"] as const;
const PAYOFF_FILES = ["payoff-thud.ogg", "payoff-rattle.ogg"] as const;

const TICK_VOICE_LIMIT = 6;
const PAYOFF_VOICE_LIMIT = 4;
/** Tick pitch offset so the climb starts a little below the sample root. */
const TICK_BASE_SEMITONES = -4;
const TICK_BASE_DB = -9;
const PAYOFF_BASE_DB = -2;
/** Fade applied when a voice is cut, to avoid clicks. */
const CUT_FADE_SECONDS = 0.015;

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
  private readonly tickVoices: Tone.ToneBufferSource[] = [];
  private readonly payoffVoices: Tone.ToneBufferSource[] = [];
  private nextTick = 0;

  private constructor(
    private readonly buffers: Tone.ToneAudioBuffers,
    private readonly random: () => number,
  ) {
    this.limiter = new Tone.Limiter(-1).toDestination();
  }

  /** Loads the samples. Rejects if any file fails to load. */
  static load(random: () => number = Math.random): Promise<SoundEngine> {
    const urls = Object.fromEntries(
      [...TICK_FILES, ...PAYOFF_FILES].map((file) => [file, file]),
    );
    return new Promise((resolve, reject) => {
      const buffers = new Tone.ToneAudioBuffers({
        urls,
        baseUrl: BASE_URL,
        onload: () => resolve(new SoundEngine(buffers, random)),
        onerror: (error) => reject(error),
      });
    });
  }

  setMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
  }

  playTick({ time, semitones, intensity }: TickHit): void {
    const file = TICK_FILES[this.nextTick % TICK_FILES.length] ?? TICK_FILES[0];
    this.nextTick += 1;
    const variation = microVariation(this.random);
    this.play(this.tickVoices, TICK_VOICE_LIMIT, file, {
      time,
      rate:
        rateForSemitones(TICK_BASE_SEMITONES + semitones) *
        rateForCents(variation.cents),
      db: TICK_BASE_DB + (intensity - 1) * 6 + variation.db,
    });
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
      this.play(this.payoffVoices, PAYOFF_VOICE_LIMIT, file, {
        time,
        rate:
          rateForSemitones(semitones - (final ? 5 : 0)) *
          rateForCents(variation.cents),
        db: PAYOFF_BASE_DB + db + (final ? 3 : 0) + variation.db,
      });
    }
  }

  dispose(): void {
    for (const voice of [...this.tickVoices, ...this.payoffVoices]) {
      voice.dispose();
    }
    this.tickVoices.length = 0;
    this.payoffVoices.length = 0;
    this.limiter.dispose();
    this.buffers.dispose();
  }

  private play(
    pool: Tone.ToneBufferSource[],
    limit: number,
    file: string,
    { time, rate, db }: { time: number; rate: number; db: number },
  ): void {
    if (pool.length >= limit) pool.shift()?.stop(time);
    const source = new Tone.ToneBufferSource({
      url: this.buffers.get(file),
      playbackRate: rate,
      fadeOut: CUT_FADE_SECONDS,
      onended: () => {
        const index = pool.indexOf(source);
        if (index !== -1) pool.splice(index, 1);
        source.dispose();
      },
    });
    source.connect(this.limiter);
    pool.push(source);
    source.start(time, 0, undefined, Tone.dbToGain(db));
  }
}
