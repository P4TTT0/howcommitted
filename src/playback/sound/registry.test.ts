import { describe, expect, it } from "vitest";
import {
  DEFAULT_KIT,
  isKitId,
  KIT_IDS,
  KIT_LABELS,
  KIT_STORAGE_KEY,
  readKit,
  writeKit,
} from "./registry";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("kit registry", () => {
  it("defaults to bubble and labels every kit", () => {
    expect(DEFAULT_KIT).toBe("bubble");
    for (const id of KIT_IDS) expect(KIT_LABELS[id]).toBeTruthy();
  });

  it("recognizes only known kits", () => {
    expect(isKitId("chips")).toBe(true);
    expect(isKitId("synth")).toBe(false);
    expect(isKitId(null)).toBe(false);
  });
});

describe("kit persistence", () => {
  it("round-trips a choice", () => {
    const storage = memoryStorage();
    writeKit(storage, "marimba");
    expect(storage.getItem(KIT_STORAGE_KEY)).toBe("marimba");
    expect(readKit(storage)).toBe("marimba");
  });

  it("falls back to the default for missing or invalid values", () => {
    expect(readKit(memoryStorage())).toBe(DEFAULT_KIT);
    expect(readKit(memoryStorage({ [KIT_STORAGE_KEY]: "nope" }))).toBe(
      DEFAULT_KIT,
    );
    expect(readKit(undefined)).toBe(DEFAULT_KIT);
  });

  it("survives blocked storage", () => {
    expect(readKit(blocked)).toBe(DEFAULT_KIT);
    expect(() => writeKit(blocked, "chips")).not.toThrow();
    expect(() => writeKit(undefined, "chips")).not.toThrow();
  });
});
