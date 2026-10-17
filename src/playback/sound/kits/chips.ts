/**
 * Chips kit: the original Kenney casino chips, pitch-shifted up the scale,
 * with a pitched-down thud and rattle for payoffs. Dry, close, a bit toy-like.
 */

import * as Tone from "tone";
import { microVariation, rateForCents, rateForSemitones } from "../../pitch";
import type { Kit, PayoffHit, TickHit } from "../kit";
import { disposePools, loadSamples, type Pool, playSample } from "../samples";

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

export async function createChipsKit(random: () => number): Promise<Kit> {
  const buffers = await loadSamples([...TICK_FILES, ...PAYOFF_FILES]);
  const limiter = new Tone.Limiter(LIMITER_DB).toDestination();
  const pools = { tick: [] as Pool, payoff: [] as Pool, accent: [] as Pool };
  let lastTick = -1;

  const pickTick = () => {
    let index = Math.floor(random() * TICK_FILES.length);
    if (index === lastTick) index = (index + 1) % TICK_FILES.length;
    lastTick = index;
    return TICK_FILES[index] ?? TICK_FILES[0];
  };

  return {
    playTick({ time, semitones, intensity }: TickHit) {
      const variation = microVariation(random);
      playSample(
        pools.tick,
        TICK_VOICE_LIMIT,
        limiter,
        buffers.get(pickTick()),
        {
          time,
          rate:
            rateForSemitones(TICK_BASE_SEMITONES + semitones) *
            rateForCents(variation.cents),
          db: TICK_BASE_DB + (intensity - 1) * 6 + variation.db,
        },
      );
    },

    playPayoff({ time, kind }: PayoffHit) {
      const final = kind === "final";
      const variation = microVariation(random, { cents: 20, db: 1 });
      // A low thud with a rattle on top; the final one drops lower, louder.
      const layers = [
        { file: PAYOFF_FILES[0], semitones: -9, db: 0 },
        { file: PAYOFF_FILES[1], semitones: -4, db: -3 },
      ];
      for (const { file, semitones, db } of layers) {
        playSample(
          pools.payoff,
          PAYOFF_VOICE_LIMIT,
          limiter,
          buffers.get(file),
          {
            time,
            rate:
              rateForSemitones(semitones - (final ? 5 : 0)) *
              rateForCents(variation.cents),
            db: PAYOFF_BASE_DB + db + (final ? 3 : 0) + variation.db,
          },
        );
      }
    },

    playAccent(time: number) {
      playSample(
        pools.accent,
        ACCENT_VOICE_LIMIT,
        limiter,
        buffers.get(PAYOFF_FILES[0]),
        {
          time,
          rate: rateForSemitones(ACCENT.semitones),
          db: ACCENT.db,
        },
      );
    },

    dispose() {
      disposePools(pools);
      limiter.dispose();
      buffers.dispose();
    },
  };
}
