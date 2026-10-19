import { describe, expect, it } from "vitest";
import {
  acceptPop,
  allowHover,
  countRate,
  countTicks,
  fillTicks,
  hoverRate,
  POP_MIN_GAP,
  stairSemitones,
} from "./gestures";

describe("stairSemitones", () => {
  it("climbs the pentatonic intervals", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(stairSemitones)).toEqual([
      0, 2, 4, 7, 9, 12, 21,
    ]);
  });

  it("holds the top step and never goes below the first", () => {
    expect(stairSemitones(40)).toBe(21);
    expect(stairSemitones(-3)).toBe(0);
    expect(stairSemitones(Number.NaN)).toBe(0);
  });
});

describe("fillTicks", () => {
  it("is empty without a duration", () => {
    expect(fillTicks(0)).toEqual([]);
  });

  it("accelerates and rises in pitch, staying inside the duration", () => {
    const ticks = fillTicks(2);
    const gaps = ticks
      .slice(1)
      .map((t, i) => t.offset - (ticks[i]?.offset ?? 0));
    expect(ticks[0]).toEqual({ offset: 0, rate: 0.8 });
    expect(gaps[0]).toBeCloseTo(0.11, 2);
    expect(gaps.at(-1)).toBeLessThan(0.04);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeLessThanOrEqual((gaps[i - 1] ?? 0) + 1e-9);
      expect(ticks[i + 1]?.rate).toBeGreaterThan(ticks[i]?.rate ?? 0);
    }
    expect(ticks.at(-1)?.offset).toBeLessThan(2);
    expect(ticks.at(-1)?.rate).toBeLessThanOrEqual(1.7);
  });

  it("keeps a long climb gentle: 140ms down to 60ms, rate 0.85 to 1.5", () => {
    const ticks = fillTicks(6);
    const gaps = ticks
      .slice(1)
      .map((t, i) => t.offset - (ticks[i]?.offset ?? 0));
    expect(ticks[0]).toEqual({ offset: 0, rate: 0.85 });
    expect(gaps[0]).toBeCloseTo(0.14, 2);
    expect(Math.min(...gaps)).toBeGreaterThan(0.06);
    expect(ticks.at(-1)?.rate).toBeLessThanOrEqual(1.5);
  });

  it("continues one climb across consecutive segments", () => {
    const first = fillTicks(2, 0, 0.5);
    const second = fillTicks(2, 0.5, 1);
    const last = first.at(-1)?.rate ?? 0;
    const next = second[0]?.rate ?? 0;
    expect(next).toBeGreaterThanOrEqual(last);
    expect(next - last).toBeLessThan(0.15);
    const rates = [...first, ...second].map((t) => t.rate);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual((rates[i - 1] ?? 0) - 1e-9);
    }
  });

  it("starts a mid-climb segment at its own pitch, not at the bottom", () => {
    const [tick] = fillTicks(1, 0.6, 0.8);
    expect(tick?.rate).toBeGreaterThan(1.2);
  });

  it("emits a single tick for a very short fill", () => {
    expect(fillTicks(0.01)).toHaveLength(1);
  });
});

describe("count", () => {
  it("spaces ticks evenly with progress 0..1", () => {
    const ticks = countTicks(1, 5);
    for (const [k, t] of ticks.entries()) expect(t.offset).toBeCloseTo(k * 0.2);
    expect(ticks[0]?.progress).toBe(0);
    expect(ticks.at(-1)?.progress).toBe(1);
  });

  it("handles degenerate input", () => {
    expect(countTicks(1, 0)).toEqual([]);
    expect(countTicks(0, 4)).toEqual([]);
    expect(countTicks(1, 1)).toEqual([{ offset: 0, progress: 0 }]);
  });

  it("raises the pitch with progress and clamps", () => {
    expect(countRate(1)).toBeGreaterThan(countRate(0));
    expect(countRate(5)).toBe(countRate(1));
    expect(countRate(-1)).toBe(countRate(0));
  });
});

describe("hoverRate", () => {
  it("maps 0..1 onto 0.8..1.4 and clamps", () => {
    expect(hoverRate(0)).toBeCloseTo(0.8);
    expect(hoverRate(0.5)).toBeCloseTo(1.1);
    expect(hoverRate(1)).toBeCloseTo(1.4);
    expect(hoverRate(9)).toBeCloseTo(1.4);
    expect(hoverRate(Number.NaN)).toBeCloseTo(0.8);
  });
});

describe("acceptPop", () => {
  it("drops pops that share a slot and keeps spaced ones", () => {
    expect(acceptPop(1, -1)).toBe(true);
    expect(acceptPop(1 + POP_MIN_GAP / 2, 1)).toBe(false);
    expect(acceptPop(1 + POP_MIN_GAP, 1)).toBe(true);
  });

  it("accepts a pop earlier than the last one (clock seek)", () => {
    expect(acceptPop(0.5, 3)).toBe(true);
  });
});

describe("allowHover", () => {
  it("throttles to one per 60ms", () => {
    expect(allowHover(100, { at: 70, target: "a" }, "b")).toBe(false);
    expect(allowHover(130, { at: 70, target: "a" }, "b")).toBe(true);
  });

  it("skips the same target twice in a row", () => {
    expect(allowHover(500, { at: 0, target: "a" }, "a")).toBe(false);
    expect(allowHover(500, { at: 0, target: "a" }, null)).toBe(true);
  });
});
