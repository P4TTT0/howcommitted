import { describe, expect, it } from "vitest";
import { isLabEnabled } from "./labGate";

describe("isLabEnabled", () => {
  it("is closed in Vercel production, even with ALLOW_LAB", () => {
    expect(isLabEnabled({ VERCEL_ENV: "production" })).toBe(false);
    expect(isLabEnabled({ VERCEL_ENV: "production", ALLOW_LAB: "1" })).toBe(
      false,
    );
  });

  it("is open in previews and Vercel development", () => {
    expect(
      isLabEnabled({ VERCEL_ENV: "preview", NODE_ENV: "production" }),
    ).toBe(true);
    expect(isLabEnabled({ VERCEL_ENV: "development" })).toBe(true);
  });

  it("is closed for unknown Vercel environments", () => {
    expect(isLabEnabled({ VERCEL_ENV: "staging" })).toBe(false);
  });

  it("is open locally outside production builds", () => {
    expect(isLabEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isLabEnabled({})).toBe(true);
  });

  it("needs ALLOW_LAB for a self-hosted production build", () => {
    expect(isLabEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isLabEnabled({ NODE_ENV: "production", ALLOW_LAB: "1" })).toBe(true);
    expect(isLabEnabled({ NODE_ENV: "production", ALLOW_LAB: "0" })).toBe(
      false,
    );
  });
});
