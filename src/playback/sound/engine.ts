/**
 * Sound engine built on recorded, tuned instruments (see
 * public/sounds/CREDITS.md), never synths.
 *
 * - Ticks: a marimba note (nearest recorded sample, shifted by at most a few
 *   semitones), a glockenspiel sparkle on the highest notes, and a very quiet
 *   un-pitched casino chip underneath for the "counting" identity.
 * - Payoff: timpani body, suspended cymbal and bell tree; the final one adds
 *   a gong. Samples play at their recorded pitch.
 * - Year accent: a soft triangle.
 * - Mix: per-group buses with filtering, a shared short reverb send, then a
 *   gentle compressor and a limiter, so stacked voices cannot clip.
 * - Voice limit: each pool caps simultaneous voices; past it the oldest is
 *   cut. Every hit is a fresh one-shot `ToneBufferSource` (a reused `Player`
 *   breaks when a long sample is still ringing at its next scheduled start).
 *
 * Hits arrive pre-aggregated and pre-quantized from the schedule; this module
 * decides how each one sounds. Variation is mostly velocity and sample choice,
 * with only a few cents of pitch.
 */

import * as Tone from "tone";
import { microVariation, rateForCents, rateForSemitones } from "../pitch";
import {
  allSampleNames,
  CHIP_FILES,
  GLOCK_MIN_MIDI,
  GLOCK_ZONES,
  MARIMBA_ZONES,
  nearestZone,
  PAYOFF_FILES,
  pickFormat,
  ROOT_MIDI,
} from "./instruments";

const BASE_URL = "/sounds/";

/** Mix levels in dB. Conservative on purpose: samples are peak-normalized. */
const MIX = {
  marimba: -13,
  glock: -24,
  chip: -26,
  timpaniStep: -9,
  timpaniFinal: -7,
  cymbal: -19,
  bellTree: -22,
  gong: -15,
  accent: -17,
} as const;

/** Reverb: decay seconds, pre-delay seconds and send amounts (linear gain). */
const REVERB = { decay: 1.5, preDelay: 0.012, tickSend: 0.2, payoffSend: 0.35 };
/** Filters on the tick bus: remove rumble, tame harsh highs. */
const TICK_HIGHPASS_HZ = 110;
const TICK_LOWPASS_HZ = 9000;
const COMPRESSOR = { threshold: -20, ratio: 2.5, attack: 0.01, release: 0.25 };
const LIMITER_DB = -1.5;

const TICK_VOICE_LIMIT = 8;
const GLOCK_VOICE_LIMIT = 4;
const CHIP_VOICE_LIMIT = 4;
const PAYOFF_VOICE_LIMIT = 6;
const ACCENT_VOICE_LIMIT = 2;
/** Fade applied when a voice is cut, to avoid clicks. */
const CUT_FADE_SECONDS = 0.02;
/** Pitch jitter in cents, and velocity jitter in dB, per tick. */
const TICK_JITTER = { cents: 6, db: 1.5 };

export type TickHit = {
  /** Audio time from the Transport callback. */
  time: number;
  /** Semitones above the root note (C4). */
  semitones: number;
  /** 0..1 */
  intensity: number;
};

export type PayoffHit = {
  time: number;
  kind: "step" | "final";
};

type Pool = Tone.ToneBufferSource[];
type Play = {
  time: number;
  /** Playback-rate multiplier; 1 plays the recording as recorded. */
  rate: number;
  db: number;
};

export class SoundEngine {
  private readonly nodes: Tone.ToneAudioNode[] = [];
  private readonly reverb: Tone.Reverb;
  private readonly tickBus: Tone.Gain;
  private readonly payoffBus: Tone.Gain;
  private readonly pools = {
    marimba: [] as Pool,
    glock: [] as Pool,
    chip: [] as Pool,
    payoff: [] as Pool,
    accent: [] as Pool,
  };
  private lastChip = -1;

  private constructor(
    private readonly buffers: Tone.ToneAudioBuffers,
    private readonly random: () => number,
  ) {
    const limiter = this.own(new Tone.Limiter(LIMITER_DB).toDestination());
    const compressor = this.own(
      new Tone.Compressor(COMPRESSOR).connect(limiter),
    );
    this.reverb = this.own(
      new Tone.Reverb({
        decay: REVERB.decay,
        preDelay: REVERB.preDelay,
        wet: 1,
      }).connect(compressor),
    );

    // Ticks: low-cut and high-tame, plus a send to the reverb.
    this.tickBus = this.own(new Tone.Gain(1));
    const highpass = this.own(
      new Tone.Filter(TICK_HIGHPASS_HZ, "highpass").connect(compressor),
    );
    const lowpass = this.own(
      new Tone.Filter(TICK_LOWPASS_HZ, "lowpass").connect(highpass),
    );
    this.tickBus.connect(lowpass);
    this.tickBus.chain(this.own(new Tone.Gain(REVERB.tickSend)), this.reverb);

    // Payoffs: full range, with a bigger reverb send.
    this.payoffBus = this.own(new Tone.Gain(1));
    this.payoffBus.connect(compressor);
    this.payoffBus.chain(
      this.own(new Tone.Gain(REVERB.payoffSend)),
      this.reverb,
    );
  }

  /** Loads the samples and pre-generates the reverb. Rejects on failure. */
  static async load(random: () => number = Math.random): Promise<SoundEngine> {
    const format = pickFormat((type) =>
      document.createElement("audio").canPlayType(type),
    );
    const urls = Object.fromEntries(
      allSampleNames().map((name) => [name, `${name}.${format}`]),
    );
    const buffers = await new Promise<Tone.ToneAudioBuffers>(
      (resolve, reject) => {
        const loaded = new Tone.ToneAudioBuffers({
          urls,
          baseUrl: BASE_URL,
          onload: () => resolve(loaded),
          onerror: (error) => reject(error),
        });
      },
    );
    const engine = new SoundEngine(buffers, random);
    await engine.reverb.ready;
    return engine;
  }

  setMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
  }

  playTick({ time, semitones, intensity }: TickHit): void {
    const midi = ROOT_MIDI + semitones;
    const variation = microVariation(this.random, TICK_JITTER);
    const velocity = (intensity - 1) * 6 + variation.db;

    const marimba = nearestZone(midi, MARIMBA_ZONES);
    this.play(
      this.pools.marimba,
      TICK_VOICE_LIMIT,
      this.tickBus,
      marimba.zone.file,
      {
        time,
        rate: rateForSemitones(marimba.shift) * rateForCents(variation.cents),
        db: MIX.marimba + velocity,
      },
    );

    if (midi >= GLOCK_MIN_MIDI) {
      const glock = nearestZone(midi, GLOCK_ZONES);
      // Brighter and louder as the run climbs.
      const climb = Math.min(4, (midi - GLOCK_MIN_MIDI) * 0.4);
      this.play(
        this.pools.glock,
        GLOCK_VOICE_LIMIT,
        this.tickBus,
        glock.zone.file,
        {
          time,
          rate: rateForSemitones(glock.shift),
          db: MIX.glock + climb + velocity,
        },
      );
    }

    // A quiet, nearly un-pitched chip under every note.
    this.play(
      this.pools.chip,
      CHIP_VOICE_LIMIT,
      this.tickBus,
      this.pickChip(),
      {
        time,
        rate: rateForSemitones(this.random() * 2 - 1),
        db: MIX.chip + velocity,
      },
    );
  }

  playPayoff({ time, kind }: PayoffHit): void {
    const final = kind === "final";
    const variation = microVariation(this.random, { cents: 0, db: 1 });
    const hit = (file: string, db: number) =>
      this.play(this.pools.payoff, PAYOFF_VOICE_LIMIT, this.payoffBus, file, {
        time,
        rate: 1,
        db: db + variation.db,
      });

    hit(
      final ? PAYOFF_FILES.timpaniFinal : PAYOFF_FILES.timpaniStep,
      final ? MIX.timpaniFinal : MIX.timpaniStep,
    );
    hit(PAYOFF_FILES.cymbal, MIX.cymbal + (final ? 2 : 0));
    hit(PAYOFF_FILES.bellTree, MIX.bellTree + (final ? 3 : 0));
    if (final) hit(PAYOFF_FILES.gong, MIX.gong);
  }

  /** A soft marker so a year change is heard, not just seen. */
  playAccent(time: number): void {
    this.play(
      this.pools.accent,
      ACCENT_VOICE_LIMIT,
      this.tickBus,
      PAYOFF_FILES.triangle,
      { time, rate: 1, db: MIX.accent },
    );
  }

  dispose(): void {
    for (const pool of Object.values(this.pools)) {
      for (const voice of pool) voice.dispose();
      pool.length = 0;
    }
    for (const node of this.nodes) node.dispose();
    this.buffers.dispose();
    // The destination is global; do not leave it muted for the next engine.
    Tone.getDestination().mute = false;
  }

  private own<T extends Tone.ToneAudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  /** Random chip sample that never repeats the previous one. */
  private pickChip(): string {
    let index = Math.floor(this.random() * CHIP_FILES.length);
    if (index === this.lastChip) index = (index + 1) % CHIP_FILES.length;
    this.lastChip = index;
    return CHIP_FILES[index] ?? CHIP_FILES[0];
  }

  private play(
    pool: Pool,
    limit: number,
    bus: Tone.Gain,
    file: string,
    { time, rate, db }: Play,
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
    source.connect(bus);
    pool.push(source);
    source.start(time, 0, undefined, Tone.dbToGain(db));
  }
}
