import { describe, expect, it } from "vitest";
import { semitonesForDegree } from "../pitch";
import {
  allSampleNames,
  GLOCK_MIN_MIDI,
  GLOCK_ZONES,
  MARIMBA_ZONES,
  MAX_SHIFT_SEMITONES,
  nearestZone,
  pickFormat,
  ROOT_MIDI,
} from "./instruments";

describe("nearestZone", () => {
  it("uses the exact sample when there is one", () => {
    expect(nearestZone(67, MARIMBA_ZONES)).toEqual({
      zone: { file: "marimba-g4", midi: 67 },
      shift: 0,
    });
  });

  it("picks the closest sample and reports the shift", () => {
    const { zone, shift } = nearestZone(64, MARIMBA_ZONES);
    expect(zone.file).toBe("marimba-g4");
    expect(shift).toBe(-3);
  });

  it("breaks ties toward the lower sample", () => {
    const { zone } = nearestZone(74, MARIMBA_ZONES);
    expect(zone.file).toBe("marimba-b4");
  });

  it("throws without zones", () => {
    expect(() => nearestZone(60, [])).toThrow();
  });
});

describe("pentatonic coverage", () => {
  const degrees = Array.from({ length: 11 }, (_, degree) => degree);

  it("never shifts a marimba sample more than the bound", () => {
    for (const degree of degrees) {
      const midi = ROOT_MIDI + semitonesForDegree(degree);
      const { shift } = nearestZone(midi, MARIMBA_ZONES);
      expect(Math.abs(shift)).toBeLessThanOrEqual(MAX_SHIFT_SEMITONES);
    }
  });

  it("never shifts a glockenspiel sample more than the bound", () => {
    for (const degree of degrees) {
      const midi = ROOT_MIDI + semitonesForDegree(degree);
      if (midi < GLOCK_MIN_MIDI) continue;
      const { shift } = nearestZone(midi, GLOCK_ZONES);
      expect(Math.abs(shift)).toBeLessThanOrEqual(MAX_SHIFT_SEMITONES);
    }
  });
});

describe("samples", () => {
  it("lists each sample once", () => {
    const names = allSampleNames();
    expect(new Set(names).size).toBe(names.length);
  });

  it("falls back to mp3 when ogg cannot be played", () => {
    expect(pickFormat(() => "probably")).toBe("ogg");
    expect(pickFormat(() => "maybe")).toBe("ogg");
    expect(pickFormat(() => "")).toBe("mp3");
  });
});
