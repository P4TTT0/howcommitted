import { describe, expect, it } from "vitest";
import { routeLogins } from "./routeLogins";

const production = { VERCEL_ENV: "production", ALLOW_LAB: "1" };
const preview = { VERCEL_ENV: "preview" };

describe("routeLogins", () => {
  it("plays solo everywhere", () => {
    expect(routeLogins(["ada"], production)).toEqual(["ada"]);
    expect(routeLogins(["ada"], preview)).toEqual(["ada"]);
  });

  it("plays versus outside production", () => {
    expect(routeLogins(["ada", "grace"], preview)).toEqual(["ada", "grace"]);
  });

  it("is not found for a multi-segment path in production", () => {
    expect(routeLogins(["ada", "grace"], production)).toBeNull();
    expect(
      routeLogins(["ada", "grace"], { NODE_ENV: "production" }),
    ).toBeNull();
  });

  it("is not found for malformed paths", () => {
    expect(routeLogins([], preview)).toBeNull();
    expect(routeLogins(["ada", "lab"], preview)).toBeNull();
  });
});
