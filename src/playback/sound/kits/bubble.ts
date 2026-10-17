/**
 * Bubble kit: soft, close, ASMR-like. Nothing is sampled; every bubble is a
 * sine whose pitch glides up fast and decays, with a tiny filtered-noise pop
 * at the start. Parameters come from `bubbleParams.ts`.
 *
 * Mix: warm low-pass, low-cut, soft compression and a limiter. No reverb, to
 * stay intimate.
 */

import * as Tone from "tone";
import type { Kit, PayoffHit, TickHit } from "../kit";
import {
  accentBubble,
  type BubbleParams,
  bloopBubble,
  clusterBubbles,
  clusterSize,
  NO_POP_DB,
  sparkleBubbles,
  tickBubble,
} from "./bubbleParams";

const LOWPASS_HZ = 7000;
const HIGHPASS_HZ = 80;
const COMPRESSOR = {
  threshold: -22,
  ratio: 2,
  knee: 20,
  attack: 0.005,
  release: 0.2,
};
const LIMITER_DB = -2;
const VOICE_LIMIT = 14;
/** Fade used to cut the oldest bubble when over the voice limit. */
const CUT_SECONDS = 0.015;
/** Floor for exponential ramps (they cannot reach zero). */
const SILENCE = 0.0001;
const POP = { hz: 2800, q: 0.8, seconds: 0.012 };
/** Oscillators stop a little after their envelope ends. */
const STOP_MARGIN_SECONDS = 0.03;

type Voice = { gain: Tone.Gain };

export async function createBubbleKit(random: () => number): Promise<Kit> {
  const nodes: Tone.ToneAudioNode[] = [];
  const own = <T extends Tone.ToneAudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };

  const limiter = own(new Tone.Limiter(LIMITER_DB).toDestination());
  const compressor = own(new Tone.Compressor(COMPRESSOR).connect(limiter));
  const highpass = own(
    new Tone.Filter(HIGHPASS_HZ, "highpass").connect(compressor),
  );
  const bus = own(new Tone.Filter(LOWPASS_HZ, "lowpass").connect(highpass));

  // One shared, always-running noise source; each bubble opens its gate for
  // a few milliseconds to make the pop.
  const popGain = own(new Tone.Gain(0).connect(bus));
  const popFilter = own(new Tone.Filter(POP.hz, "bandpass").connect(popGain));
  popFilter.Q.value = POP.q;
  const noise = own(new Tone.Noise("pink").connect(popFilter));
  noise.start();

  const active: Voice[] = [];

  function pop(time: number, db: number) {
    if (db <= NO_POP_DB) return;
    popGain.gain.setValueAtTime(Tone.dbToGain(db), time);
    popGain.gain.exponentialRampToValueAtTime(SILENCE, time + POP.seconds);
  }

  function play(params: BubbleParams, hitTime: number) {
    const time = hitTime + params.offsetSeconds;
    if (active.length >= VOICE_LIMIT) {
      // Cut the oldest by fading its gain; its oscillator stops on schedule.
      const oldest = active.shift();
      oldest?.gain.gain.cancelAndHoldAtTime(time);
      oldest?.gain.gain.linearRampToValueAtTime(0, time + CUT_SECONDS);
    }

    const end = time + params.attackSeconds + params.decaySeconds;
    const oscillator = new Tone.Oscillator({
      type: "sine",
      frequency: params.startHz,
    });
    const gain = new Tone.Gain(0);
    const panner = new Tone.Panner(params.pan);
    oscillator.chain(gain, panner, bus);

    oscillator.frequency.setValueAtTime(params.startHz, time);
    oscillator.frequency.exponentialRampToValueAtTime(
      params.endHz,
      time + params.glideSeconds,
    );
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(
      Tone.dbToGain(params.db),
      time + params.attackSeconds,
    );
    gain.gain.exponentialRampToValueAtTime(SILENCE, end);

    const voice: Voice = { gain };
    active.push(voice);
    oscillator.onstop = () => {
      const index = active.indexOf(voice);
      if (index !== -1) active.splice(index, 1);
      oscillator.dispose();
      gain.dispose();
      panner.dispose();
    };
    oscillator.start(time);
    oscillator.stop(end + STOP_MARGIN_SECONDS);
    pop(time, params.popDb);
  }

  return {
    playTick({ time, semitones, intensity }: TickHit) {
      const base = tickBubble(semitones, intensity, random);
      const size = clusterSize(intensity, random);
      for (const bubble of clusterBubbles(base, size, random)) {
        play(bubble, time);
      }
    },

    playPayoff({ time, kind }: PayoffHit) {
      play(bloopBubble(kind, random), time);
      for (const bubble of sparkleBubbles(kind, random)) play(bubble, time);
    },

    playAccent(time: number) {
      play(accentBubble(random), time);
    },

    dispose() {
      noise.stop();
      for (const node of nodes) node.dispose();
      active.length = 0;
    },
  };
}
