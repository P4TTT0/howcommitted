/**
 * Marimba kit: tuned VSCO 2 CE instruments.
 *
 * - Ticks: a marimba note (nearest recorded sample, shifted by at most a few
 *   semitones), a glockenspiel sparkle on the highest notes, and a very quiet
 *   un-pitched casino chip underneath.
 * - Payoff: timpani, suspended cymbal and bell tree; the final adds a gong.
 * - Year accent: a soft triangle.
 * - Mix: filtered tick bus, short reverb send, gentle compressor, limiter.
 */

import * as Tone from "tone";
import { microVariation, rateForCents, rateForSemitones } from "../../pitch";
import {
  allSampleNames,
  CHIP_FILES,
  GLOCK_MIN_MIDI,
  GLOCK_ZONES,
  MARIMBA_ZONES,
  nearestZone,
  PAYOFF_FILES,
  ROOT_MIDI,
} from "../instruments";
import type { Kit, PayoffHit, TickHit } from "../kit";
import { disposePools, loadSamples, type Pool, playSample } from "../samples";

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
/** Pitch jitter in cents, and velocity jitter in dB, per tick. */
const TICK_JITTER = { cents: 6, db: 1.5 };

export async function createMarimbaKit(random: () => number): Promise<Kit> {
  const buffers = await loadSamples(allSampleNames());
  const nodes: Tone.ToneAudioNode[] = [];
  const own = <T extends Tone.ToneAudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };

  const limiter = own(new Tone.Limiter(LIMITER_DB).toDestination());
  const compressor = own(new Tone.Compressor(COMPRESSOR).connect(limiter));
  const reverb = own(
    new Tone.Reverb({
      decay: REVERB.decay,
      preDelay: REVERB.preDelay,
      wet: 1,
    }).connect(compressor),
  );
  // Ticks: low-cut and high-tame, plus a send to the reverb.
  const tickBus = own(new Tone.Gain(1));
  const highpass = own(
    new Tone.Filter(TICK_HIGHPASS_HZ, "highpass").connect(compressor),
  );
  const lowpass = own(
    new Tone.Filter(TICK_LOWPASS_HZ, "lowpass").connect(highpass),
  );
  tickBus.connect(lowpass);
  tickBus.chain(own(new Tone.Gain(REVERB.tickSend)), reverb);
  // Payoffs: full range, with a bigger reverb send.
  const payoffBus = own(new Tone.Gain(1));
  payoffBus.connect(compressor);
  payoffBus.chain(own(new Tone.Gain(REVERB.payoffSend)), reverb);
  await reverb.ready;

  const pools = {
    marimba: [] as Pool,
    glock: [] as Pool,
    chip: [] as Pool,
    payoff: [] as Pool,
    accent: [] as Pool,
  };
  let lastChip = -1;
  const pickChip = () => {
    let index = Math.floor(random() * CHIP_FILES.length);
    if (index === lastChip) index = (index + 1) % CHIP_FILES.length;
    lastChip = index;
    return CHIP_FILES[index] ?? CHIP_FILES[0];
  };

  return {
    playTick({ time, semitones, intensity }: TickHit) {
      const midi = ROOT_MIDI + semitones;
      const variation = microVariation(random, TICK_JITTER);
      const velocity = (intensity - 1) * 6 + variation.db;

      const marimba = nearestZone(midi, MARIMBA_ZONES);
      playSample(
        pools.marimba,
        TICK_VOICE_LIMIT,
        tickBus,
        buffers.get(marimba.zone.file),
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
        playSample(
          pools.glock,
          GLOCK_VOICE_LIMIT,
          tickBus,
          buffers.get(glock.zone.file),
          {
            time,
            rate: rateForSemitones(glock.shift),
            db: MIX.glock + climb + velocity,
          },
        );
      }

      // A quiet, nearly un-pitched chip under every note.
      playSample(
        pools.chip,
        CHIP_VOICE_LIMIT,
        tickBus,
        buffers.get(pickChip()),
        {
          time,
          rate: rateForSemitones(random() * 2 - 1),
          db: MIX.chip + velocity,
        },
      );
    },

    playPayoff({ time, kind }: PayoffHit) {
      const final = kind === "final";
      const variation = microVariation(random, { cents: 0, db: 1 });
      const hit = (file: string, db: number) =>
        playSample(
          pools.payoff,
          PAYOFF_VOICE_LIMIT,
          payoffBus,
          buffers.get(file),
          { time, rate: 1, db: db + variation.db },
        );

      hit(
        final ? PAYOFF_FILES.timpaniFinal : PAYOFF_FILES.timpaniStep,
        final ? MIX.timpaniFinal : MIX.timpaniStep,
      );
      hit(PAYOFF_FILES.cymbal, MIX.cymbal + (final ? 2 : 0));
      hit(PAYOFF_FILES.bellTree, MIX.bellTree + (final ? 3 : 0));
      if (final) hit(PAYOFF_FILES.gong, MIX.gong);
    },

    playAccent(time: number) {
      playSample(
        pools.accent,
        ACCENT_VOICE_LIMIT,
        tickBus,
        buffers.get(PAYOFF_FILES.triangle),
        { time, rate: 1, db: MIX.accent },
      );
    },

    dispose() {
      disposePools(pools);
      for (const node of nodes) node.dispose();
      buffers.dispose();
    },
  };
}
