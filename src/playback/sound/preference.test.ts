import { describe, expect, it } from "vitest";
import {
  experienceSoundOn,
  landingSoundOn,
  readSoundPreference,
  writeSoundPreference,
} from "./preference";

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set("committed:sound", initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("sound preference", () => {
  it("is unset by default, for junk values and without storage", () => {
    expect(readSoundPreference(memory())).toBe("unset");
    expect(readSoundPreference(memory("maybe"))).toBe("unset");
    expect(readSoundPreference(null)).toBe("unset");
    expect(readSoundPreference(throwing)).toBe("unset");
  });

  it("round-trips on and off", () => {
    const store = memory();
    writeSoundPreference(true, store);
    expect(readSoundPreference(store)).toBe("on");
    writeSoundPreference(false, store);
    expect(readSoundPreference(store)).toBe("off");
  });

  it("never throws when storage is blocked", () => {
    expect(() => writeSoundPreference(true, throwing)).not.toThrow();
    expect(() => writeSoundPreference(true, null)).not.toThrow();
  });

  it("the landing needs an explicit on", () => {
    expect(landingSoundOn("unset")).toBe(false);
    expect(landingSoundOn("off")).toBe(false);
    expect(landingSoundOn("on")).toBe(true);
  });

  it("the experience is on unless turned off", () => {
    expect(experienceSoundOn("unset")).toBe(true);
    expect(experienceSoundOn("on")).toBe(true);
    expect(experienceSoundOn("off")).toBe(false);
  });
});
