import { describe, expect, it } from "vitest";
import {
  cellFill,
  easedPercent,
  PHRASES,
  PROGRESS_CELLS,
  phraseIndex,
  phrasesFor,
  playerBlockClass,
} from "./loadingProgress";

describe("easedPercent", () => {
  it("starts at zero and only moves forward", () => {
    expect(easedPercent(0)).toBe(0);
    expect(easedPercent(-5)).toBe(0);
    let last = 0;
    for (let ms = 0; ms <= 120_000; ms += 500) {
      const value = easedPercent(ms);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });

  it("never reaches 100, however long the wait", () => {
    expect(easedPercent(10 * 60_000)).toBe(99);
    expect(easedPercent(Number.POSITIVE_INFINITY)).toBe(99);
  });
});

describe("phraseIndex", () => {
  it("walks the list and stays in range", () => {
    expect(phraseIndex(0)).toBe(0);
    expect(phraseIndex(99)).toBe(PHRASES.length - 1);
    expect(phraseIndex(100)).toBe(PHRASES.length - 1);
  });
});

describe("cellFill", () => {
  it("fills cells one after another", () => {
    expect(cellFill(0, 0)).toBe(0);
    expect(cellFill(100, PROGRESS_CELLS - 1)).toBeCloseTo(1, 9);
    expect(cellFill(50, 0)).toBe(1);
    expect(cellFill(50, PROGRESS_CELLS - 1)).toBe(0);
    const mid = cellFill(50, 5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("phrasesFor", () => {
  it("keeps the shared list for one developer", () => {
    expect(phrasesFor(1)).toEqual(PHRASES);
  });

  it("adds versus phrases for several, keeping every shared one", () => {
    const list = phrasesFor(3);
    expect(list).toHaveLength(PHRASES.length + 2);
    for (const phrase of PHRASES) expect(list).toContain(phrase);
    expect(list[list.length - 1]).toBe(PHRASES[PHRASES.length - 1]);
  });
});

describe("phraseIndex with a custom count", () => {
  it("stays in range for any list length", () => {
    expect(phraseIndex(0, 10)).toBe(0);
    expect(phraseIndex(99, 10)).toBe(9);
    expect(phraseIndex(50, 10)).toBe(5);
  });
});

describe("playerBlockClass", () => {
  it("follows player order and wraps", () => {
    expect(playerBlockClass(0)).toContain("bg-versus-p1");
    expect(playerBlockClass(4)).toContain("bg-versus-p5");
    expect(playerBlockClass(5)).toBe(playerBlockClass(0));
  });
});
