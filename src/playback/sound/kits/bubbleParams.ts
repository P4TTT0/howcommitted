/**
 * Pure parameter generator for the bubble kit. A bubble is a sine whose
 * pitch glides quickly upward (the resonance of a bubble forming) and then
 * decays. Every number a hit uses is produced here from an injected random
 * source, so the ranges are testable and the synth code stays dumb.
 */

import { semitonesForDegree } from "../../pitch";
import { ROOT_MIDI } from "../instruments";

export type Range = readonly [min: number, max: number];

/** Tunable ranges. Times in seconds, levels in dB. */
export const BUBBLE = {
  /** Bubbles sit an octave above the root so they stay light, not boomy. */
  octaveShift: 12,
  /** Start pitch as a fraction of the note. */
  startRatio: [0.62, 0.8] as Range,
  /**
   * End pitch as a fraction of the note. Close to 1 so the settled pitch
   * stays on the scale instead of drifting sharp.
   */
  endRatio: [1, 1.04] as Range,
  glideSeconds: [0.02, 0.06] as Range,
  attackSeconds: [0.001, 0.003] as Range,
  decaySeconds: [0.06, 0.18] as Range,
  /** Random pitch offset, plus or minus. */
  cents: 10,
  /** Random stereo position, plus or minus (0 is center). */
  pan: 0.3,
  /** Velocity jitter, plus or minus dB. */
  velocityDb: 1.5,
  baseDb: -17,
  /** Noise pop level relative to the bubble. */
  popOffsetDb: -22,
  /** Heavy weeks may fire a small cluster. */
  cluster: {
    minIntensity: 0.7,
    twoChance: 0.35,
    threeChance: 0.12,
    offsetSeconds: [0.01, 0.035] as Range,
    stepDb: -3.5,
  },
  bloop: {
    stepMidi: 48,
    finalMidi: 43,
    decaySeconds: [0.38, 0.45] as Range,
    glideSeconds: [0.05, 0.08] as Range,
    db: -14,
    finalBoostDb: 2,
  },
  /** Quick rising cluster that follows the bloop. */
  sparkle: {
    steps: 4,
    finalSteps: 6,
    spanSeconds: 0.15,
    startDegree: 3,
    decaySeconds: [0.05, 0.09] as Range,
    db: -19,
  },
  accent: {
    midi: 43,
    decaySeconds: [0.3, 0.36] as Range,
    glideSeconds: [0.05, 0.07] as Range,
    db: -16,
  },
} as const;

/** Pop level that means "no pop". */
export const NO_POP_DB = -120;

export type BubbleParams = {
  startHz: number;
  endHz: number;
  glideSeconds: number;
  attackSeconds: number;
  decaySeconds: number;
  db: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** Level of the noise pop at the start, in dB. */
  popDb: number;
  /** Seconds after the hit time at which this bubble starts. */
  offsetSeconds: number;
};

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function within([min, max]: Range, random: () => number): number {
  return min + (max - min) * random();
}

function centered(amount: number, random: () => number): number {
  return (random() * 2 - 1) * amount;
}

function bubble(
  noteHz: number,
  {
    glide,
    decay,
    db,
    random,
  }: { glide: Range; decay: Range; db: number; random: () => number },
): BubbleParams {
  const detune = 2 ** (centered(BUBBLE.cents, random) / 1200);
  return {
    startHz: noteHz * within(BUBBLE.startRatio, random) * detune,
    endHz: noteHz * within(BUBBLE.endRatio, random) * detune,
    glideSeconds: within(glide, random),
    attackSeconds: within(BUBBLE.attackSeconds, random),
    decaySeconds: within(decay, random),
    db: db + centered(BUBBLE.velocityDb, random),
    pan: centered(BUBBLE.pan, random),
    popDb: db + BUBBLE.popOffsetDb,
    offsetSeconds: 0,
  };
}

/** One tick's bubble for the note `semitones` above the root. */
export function tickBubble(
  semitones: number,
  intensity: number,
  random: () => number,
): BubbleParams {
  const midi = ROOT_MIDI + BUBBLE.octaveShift + semitones;
  return bubble(midiToHz(midi), {
    glide: BUBBLE.glideSeconds,
    decay: BUBBLE.decaySeconds,
    db: BUBBLE.baseDb + (intensity - 1) * 6,
    random,
  });
}

/** How many bubbles a tick fires: 1 for most, 2 or 3 for heavy weeks. */
export function clusterSize(
  intensity: number,
  random: () => number,
): 1 | 2 | 3 {
  const { minIntensity, twoChance, threeChance } = BUBBLE.cluster;
  if (intensity < minIntensity) return 1;
  const roll = random();
  if (roll < threeChance) return 3;
  if (roll < twoChance) return 2;
  return 1;
}

/** The base bubble plus tiny-offset, quieter, shorter companions. */
export function clusterBubbles(
  base: BubbleParams,
  size: number,
  random: () => number,
): BubbleParams[] {
  const bubbles = [base];
  let offset = 0;
  for (let i = 1; i < size; i += 1) {
    offset += within(BUBBLE.cluster.offsetSeconds, random);
    const detune = 2 ** (centered(BUBBLE.cents, random) / 1200);
    bubbles.push({
      ...base,
      startHz: base.startHz * detune,
      endHz: base.endHz * detune,
      decaySeconds: base.decaySeconds * 0.8,
      db: base.db + BUBBLE.cluster.stepDb * i,
      pan: centered(BUBBLE.pan, random),
      popDb: NO_POP_DB,
      offsetSeconds: offset,
    });
  }
  return bubbles;
}

/** The round, low "bloop" at the heart of a payoff. */
export function bloopBubble(
  kind: "step" | "final",
  random: () => number,
): BubbleParams {
  const { stepMidi, finalMidi, decaySeconds, glideSeconds, db, finalBoostDb } =
    BUBBLE.bloop;
  const final = kind === "final";
  return bubble(midiToHz(final ? finalMidi : stepMidi), {
    glide: glideSeconds,
    decay: decaySeconds,
    db: db + (final ? finalBoostDb : 0),
    random,
  });
}

/** A quick rising run of small bubbles right after the bloop. */
export function sparkleBubbles(
  kind: "step" | "final",
  random: () => number,
): BubbleParams[] {
  const { steps, finalSteps, spanSeconds, startDegree, decaySeconds, db } =
    BUBBLE.sparkle;
  const count = kind === "final" ? finalSteps : steps;
  return Array.from({ length: count }, (_, index) => {
    const semitones = semitonesForDegree(startDegree + index);
    const midi = ROOT_MIDI + BUBBLE.octaveShift + semitones;
    const params = bubble(midiToHz(midi), {
      glide: BUBBLE.glideSeconds,
      decay: decaySeconds,
      db: db + index * 0.5,
      random,
    });
    return {
      ...params,
      popDb: NO_POP_DB,
      offsetSeconds: (index / Math.max(1, count - 1)) * spanSeconds,
    };
  });
}

/** One deep, soft bubble for a year change. */
export function accentBubble(random: () => number): BubbleParams {
  const { midi, decaySeconds, glideSeconds, db } = BUBBLE.accent;
  return bubble(midiToHz(midi), {
    glide: glideSeconds,
    decay: decaySeconds,
    db,
    random,
  });
}
