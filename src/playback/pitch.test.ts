import { describe, expect, it } from "vitest";
import {
  degreeForAccumulation,
  degreeInRegister,
  microVariation,
  rateForCents,
  rateForSemitones,
  restartRegister,
  semitonesForDegree,
} from "./pitch";

describe("degreeForAccumulation", () => {
  it("starts at the root and never decreases", () => {
    expect(degreeForAccumulation(0)).toBe(0);
    let previous = 0;
    for (let accumulated = 0; accumulated <= 2000; accumulated += 25) {
      const degree = degreeForAccumulation(accumulated);
      expect(degree).toBeGreaterThanOrEqual(previous);
      previous = degree;
    }
  });

  it("holds at the top degree", () => {
    expect(degreeForAccumulation(900)).toBe(10);
    expect(degreeForAccumulation(1_000_000)).toBe(10);
  });
});

describe("semitonesForDegree", () => {
  it("walks a pentatonic scale across octaves", () => {
    const semitones = [0, 1, 2, 3, 4, 5, 6].map(semitonesForDegree);
    expect(semitones).toEqual([0, 2, 4, 7, 9, 12, 14]);
  });
});

describe("rates", () => {
  it("doubles the rate per octave", () => {
    expect(rateForSemitones(12)).toBeCloseTo(2);
    expect(rateForSemitones(-12)).toBeCloseTo(0.5);
    expect(rateForCents(1200)).toBeCloseTo(2);
    expect(rateForCents(0)).toBe(1);
  });
});

describe("microVariation", () => {
  it("stays inside the configured bounds", () => {
    expect(microVariation(() => 0, { cents: 10, db: 2 })).toEqual({
      cents: -10,
      db: -2,
    });
    expect(microVariation(() => 1, { cents: 10, db: 2 })).toEqual({
      cents: 10,
      db: 2,
    });
    expect(microVariation(() => 0.5)).toEqual({ cents: 0, db: 0 });
  });
});

describe("degreeInRegister", () => {
  it("starts at the register and still reaches the top", () => {
    expect(degreeInRegister(0, 5)).toBe(5);
    expect(degreeInRegister(900, 5)).toBe(10);
    expect(degreeInRegister(1_000_000, 5)).toBe(10);
  });

  it("never decreases as the run accumulates", () => {
    let previous = 0;
    for (let accumulated = 0; accumulated <= 1000; accumulated += 20) {
      const degree = degreeInRegister(accumulated, 4);
      expect(degree).toBeGreaterThanOrEqual(previous);
      previous = degree;
    }
  });
});

describe("restartRegister", () => {
  it("keeps part of the previous peak instead of dropping to the root", () => {
    expect(restartRegister(10, 0)).toBeGreaterThanOrEqual(4);
    expect(restartRegister(10, 1)).toBeGreaterThanOrEqual(4);
  });

  it("rotates between consecutive runs", () => {
    const registers = [0, 1, 2, 3].map((run) => restartRegister(8, run));
    expect(new Set(registers).size).toBeGreaterThan(1);
  });

  it("stays inside the room to climb", () => {
    for (let run = 0; run < 8; run += 1) {
      expect(restartRegister(10, run)).toBeLessThanOrEqual(7);
      expect(restartRegister(0, run)).toBeGreaterThanOrEqual(0);
    }
  });
});
