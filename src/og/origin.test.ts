import { describe, expect, it } from "vitest";
import { PRODUCTION_ORIGIN, resolveSiteOrigin } from "./origin";

describe("resolveSiteOrigin", () => {
  it("uses the canonical www origin in production, ignoring deployment URLs", () => {
    expect(
      resolveSiteOrigin({
        VERCEL_ENV: "production",
        VERCEL_URL: "howcommitted-abc.vercel.app",
      }),
    ).toBe(PRODUCTION_ORIGIN);
  });

  it("prefers the branch URL of a preview, then the deployment URL", () => {
    expect(
      resolveSiteOrigin({
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "howcommitted-git-feat.vercel.app",
        VERCEL_URL: "howcommitted-abc.vercel.app",
      }),
    ).toBe("https://howcommitted-git-feat.vercel.app");
    expect(
      resolveSiteOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "howcommitted-abc.vercel.app",
      }),
    ).toBe("https://howcommitted-abc.vercel.app");
  });

  it("never points a preview at production", () => {
    expect(resolveSiteOrigin({ VERCEL_ENV: "preview" })).not.toBe(
      PRODUCTION_ORIGIN,
    );
  });

  it("falls back to localhost elsewhere", () => {
    expect(resolveSiteOrigin({})).toBe("http://localhost:3000");
    expect(resolveSiteOrigin({ PORT: "4000" })).toBe("http://localhost:4000");
    expect(resolveSiteOrigin({ VERCEL_ENV: "development" })).toBe(
      "http://localhost:3000",
    );
  });
});
