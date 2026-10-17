import { describe, expect, it } from "vitest";
import {
  accentBubble,
  BUBBLE,
  bloopBubble,
  clusterBubbles,
  clusterSize,
  midiToHz,
  sparkleBubbles,
  tickBubble,
} from "./bubbleParams";

/** Deterministic random source cycling through the unit interval. */
function sequence(values: number[]) {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

const lowest = () => 0;
const highest = () => 0.999999;
const cents = (ratio: number) => 2 ** (ratio / 1200);

describe("tickBubble", () => {
  it("glides up from well below the note to just about the note", () => {
    for (const random of [lowest, highest, sequence([0.3, 0.7, 0.5])]) {
      const params = tickBubble(7, 1, random);
      expect(params.startHz).toBeLessThan(params.endHz);
      const note = midiToHz(60 + BUBBLE.octaveShift + 7);
      const slack = cents(BUBBLE.cents);
      expect(params.startHz).toBeGreaterThanOrEqual(
        note * BUBBLE.startRatio[0] * (1 / slack) - 1e-6,
      );
      expect(params.startHz).toBeLessThanOrEqual(
        note * BUBBLE.startRatio[1] * slack + 1e-6,
      );
      expect(params.endHz).toBeGreaterThanOrEqual(
        note * BUBBLE.endRatio[0] * (1 / slack) - 1e-6,
      );
      expect(params.endHz).toBeLessThanOrEqual(
        note * BUBBLE.endRatio[1] * slack + 1e-6,
      );
    }
  });

  it("keeps glide, attack and decay inside their ranges", () => {
    for (const random of [lowest, highest]) {
      const params = tickBubble(0, 1, random);
      expect(params.glideSeconds).toBeGreaterThanOrEqual(
        BUBBLE.glideSeconds[0],
      );
      expect(params.glideSeconds).toBeLessThanOrEqual(BUBBLE.glideSeconds[1]);
      expect(params.attackSeconds).toBeGreaterThanOrEqual(
        BUBBLE.attackSeconds[0],
      );
      expect(params.attackSeconds).toBeLessThanOrEqual(BUBBLE.attackSeconds[1]);
      expect(params.decaySeconds).toBeGreaterThanOrEqual(
        BUBBLE.decaySeconds[0],
      );
      expect(params.decaySeconds).toBeLessThanOrEqual(BUBBLE.decaySeconds[1]);
    }
  });

  it("bounds the pan and velocity variation", () => {
    for (const random of [lowest, highest]) {
      const params = tickBubble(0, 1, random);
      expect(Math.abs(params.pan)).toBeLessThanOrEqual(BUBBLE.pan + 1e-9);
      expect(Math.abs(params.db - BUBBLE.baseDb)).toBeLessThanOrEqual(
        BUBBLE.velocityDb + 1e-9,
      );
    }
  });

  it("is quieter for lighter weeks and keeps the pop far below the bubble", () => {
    const loud = tickBubble(0, 1, () => 0.5);
    const soft = tickBubble(0, 0.1, () => 0.5);
    expect(soft.db).toBeLessThan(loud.db);
    expect(loud.popDb).toBeLessThanOrEqual(loud.db + BUBBLE.popOffsetDb);
  });

  it("rises with the note", () => {
    const low = tickBubble(0, 1, () => 0.5);
    const high = tickBubble(24, 1, () => 0.5);
    expect(high.endHz).toBeGreaterThan(low.endHz);
  });
});

describe("clusters", () => {
  it("never clusters light weeks", () => {
    expect(clusterSize(0.3, () => 0)).toBe(1);
    expect(clusterSize(BUBBLE.cluster.minIntensity - 0.01, () => 0)).toBe(1);
  });

  it("clusters heavy weeks only some of the time", () => {
    expect(clusterSize(1, () => 0)).toBe(3);
    expect(clusterSize(1, () => 0.2)).toBe(2);
    expect(clusterSize(1, () => 0.9)).toBe(1);
  });

  it("builds quieter companions at small, increasing offsets", () => {
    const base = tickBubble(0, 1, () => 0.5);
    const bubbles = clusterBubbles(base, 3, () => 0.5);
    expect(bubbles).toHaveLength(3);
    expect(bubbles[0]).toBe(base);
    const [, second, third] = bubbles;
    expect(second?.offsetSeconds).toBeGreaterThan(0);
    expect(third?.offsetSeconds ?? 0).toBeGreaterThan(
      second?.offsetSeconds ?? 0,
    );
    expect(third?.offsetSeconds ?? 1).toBeLessThanOrEqual(
      BUBBLE.cluster.offsetSeconds[1] * 2 + 1e-9,
    );
    expect(second?.db ?? 0).toBeLessThan(base.db);
    expect(third?.db ?? 0).toBeLessThan(second?.db ?? 0);
  });

  it("returns just the base bubble for a size of one", () => {
    const base = tickBubble(0, 1, () => 0.5);
    expect(clusterBubbles(base, 1, () => 0.5)).toEqual([base]);
  });
});

describe("payoff and accent", () => {
  it("makes the bloop lower and longer than a tick", () => {
    const tick = tickBubble(0, 1, () => 0.5);
    const bloop = bloopBubble("step", () => 0.5);
    expect(bloop.endHz).toBeLessThan(tick.endHz);
    expect(bloop.decaySeconds).toBeGreaterThan(BUBBLE.decaySeconds[1]);
    expect(bloopBubble("final", () => 0.5).endHz).toBeLessThan(bloop.endHz);
  });

  it("rises through a quick sparkle, longer for the final", () => {
    const step = sparkleBubbles("step", () => 0.5);
    const final = sparkleBubbles("final", () => 0.5);
    expect(step).toHaveLength(BUBBLE.sparkle.steps);
    expect(final).toHaveLength(BUBBLE.sparkle.finalSteps);
    for (let i = 1; i < step.length; i += 1) {
      expect(step[i]?.endHz ?? 0).toBeGreaterThan(step[i - 1]?.endHz ?? 0);
      expect(step[i]?.offsetSeconds ?? 0).toBeGreaterThan(
        step[i - 1]?.offsetSeconds ?? 0,
      );
    }
    expect(step.at(-1)?.offsetSeconds).toBeCloseTo(BUBBLE.sparkle.spanSeconds);
  });

  it("keeps the year accent deep and soft", () => {
    const accent = accentBubble(() => 0.5);
    const tick = tickBubble(0, 1, () => 0.5);
    expect(accent.endHz).toBeLessThan(tick.endHz);
    expect(accent.db).toBeLessThan(-10);
  });
});
