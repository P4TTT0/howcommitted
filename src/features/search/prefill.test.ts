import { describe, expect, it } from "vitest";
import { consumePrefill, recordPrefill } from "./prefill";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("search prefill", () => {
  it("hands the login over exactly once", () => {
    const store = memoryStore();
    recordPrefill("ada", store);
    expect(consumePrefill(store)).toBe("ada");
    expect(consumePrefill(store)).toBeNull();
  });

  it("is empty without a record or without storage", () => {
    expect(consumePrefill(memoryStore())).toBeNull();
    expect(consumePrefill(null)).toBeNull();
    expect(() => recordPrefill("ada", null)).not.toThrow();
  });

  it("never throws when storage does", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(consumePrefill(blocked)).toBeNull();
    expect(() => recordPrefill("ada", blocked)).not.toThrow();
  });
});
