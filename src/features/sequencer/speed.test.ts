import { describe, expect, it } from "vitest";
import { nextSpeed, readSpeed, SPEEDS, speedLabel, writeSpeed } from "./speed";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("speed", () => {
  it("offers 0.5x, 1x, 1.5x and 2x", () => {
    expect(SPEEDS).toEqual([0.5, 1, 1.5, 2]);
    expect(SPEEDS.map(speedLabel)).toEqual(["0.5×", "1×", "1.5×", "2×"]);
  });

  it("cycles through the speeds and wraps", () => {
    expect(nextSpeed(0.5)).toBe(1);
    expect(nextSpeed(1)).toBe(1.5);
    expect(nextSpeed(2)).toBe(0.5);
    expect(nextSpeed(7)).toBe(0.5);
  });

  it("remembers the chosen speed for the session", () => {
    const store = memoryStore();
    expect(readSpeed(store)).toBe(1);
    writeSpeed(1.5, store);
    expect(readSpeed(store)).toBe(1.5);
  });

  it("falls back to 1x on junk or missing storage", () => {
    expect(readSpeed(memoryStore({ "committed:speed": "9" }))).toBe(1);
    expect(readSpeed(memoryStore({ "committed:speed": "fast" }))).toBe(1);
    expect(readSpeed(null)).toBe(1);
    expect(() => writeSpeed(2, null)).not.toThrow();
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readSpeed(throwing)).toBe(1);
    expect(() => writeSpeed(2, throwing)).not.toThrow();
  });
});
