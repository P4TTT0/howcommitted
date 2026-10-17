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
 */

import * as Tone from "tone";
import { microVariation, rateForCents, rateForSemitones } from "../pitch";
import { disposePools, loadSamples, type Pool, playSample } from "./samples";

const TICK_FILES = ["chip-1", "chip-2", "chip-3"] as const;
const PAYOFF_FILES = ["payoff-thud", "payoff-rattle"] as const;

const TICK_VOICE_LIMIT = 6;
const PAYOFF_VOICE_LIMIT = 4;
const ACCENT_VOICE_LIMIT = 2;
/** Tick pitch offset so the climb starts a little below the sample root. */
const TICK_BASE_SEMITONES = -4;
const TICK_BASE_DB = -9;
const PAYOFF_BASE_DB = -2;
const ACCENT = { semitones: -5, db: -11 };
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
  };
  private lastTick = -1;

  private constructor(
    private readonly buffers: Tone.ToneAudioBuffers,
    private readonly random: () => number,
  ) {
    this.limiter = new Tone.Limiter(LIMITER_DB).toDestination();
  }

  /** Loads the samples. Rejects if any file fails to load. */
  static async load(random: () => number = Math.random): Promise<SoundEngine> {
    const buffers = await loadSamples([...TICK_FILES, ...PAYOFF_FILES]);
    return new SoundEngine(buffers, random);
  }

  setMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
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
        db: TICK_BASE_DB + (intensity - 1) * 6 + variation.db,
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
