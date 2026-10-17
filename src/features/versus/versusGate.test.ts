import { describe, expect, it } from "vitest";
import { isVersusEnabled } from "./versusGate";

describe("isVersusEnabled", () => {
  it("is closed in production and open in previews and development", () => {
    expect(isVersusEnabled({ VERCEL_ENV: "production" })).toBe(false);
    expect(isVersusEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isVersusEnabled({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isVersusEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isVersusEnabled({ NODE_ENV: "production", ALLOW_LAB: "1" })).toBe(
      true,
    );
  });
});
