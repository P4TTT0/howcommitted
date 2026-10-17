import { describe, expect, it } from "vitest";
import { consumeIntent, recordIntent } from "./intent";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("start intent", () => {
  it("is consumed exactly once", () => {
    const store = memoryStore();
    recordIntent("Ada", store);
    expect(consumeIntent("ada", store)).toBe(true);
    expect(consumeIntent("ada", store)).toBe(false);
  });

  it("does not apply to another login, and is cleared anyway", () => {
    const store = memoryStore();
    recordIntent("ada", store);
    expect(consumeIntent("grace", store)).toBe(false);
    expect(consumeIntent("ada", store)).toBe(false);
  });

  it("is absent without a record or without storage", () => {
    expect(consumeIntent("ada", memoryStore())).toBe(false);
    expect(consumeIntent("ada", null)).toBe(false);
    expect(() => recordIntent("ada", null)).not.toThrow();
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    expect(() => recordIntent("ada", broken)).not.toThrow();
    expect(consumeIntent("ada", broken)).toBe(false);
  });
});
