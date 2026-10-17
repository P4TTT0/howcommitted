import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, coldGenerationsPerDay } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("coldGenerationsPerDay", () => {
  it("falls back to the default when unset or blank", () => {
    vi.stubEnv("QUOTA_COLD_PER_DAY", "");
    expect(coldGenerationsPerDay(2)).toBe(2);
    vi.stubEnv("QUOTA_COLD_PER_DAY", "  ");
    expect(coldGenerationsPerDay(2)).toBe(2);
  });

  it("reads a whole number, including zero", () => {
    vi.stubEnv("QUOTA_COLD_PER_DAY", " 100 ");
    expect(coldGenerationsPerDay(2)).toBe(100);
    vi.stubEnv("QUOTA_COLD_PER_DAY", "0");
    expect(coldGenerationsPerDay(2)).toBe(0);
  });

  it("rejects anything that is not a whole number", () => {
    for (const value of ["-1", "1.5", "ten", "1e3"]) {
      vi.stubEnv("QUOTA_COLD_PER_DAY", value);
      expect(() => coldGenerationsPerDay(2)).toThrow(ConfigError);
    }
  });
});
