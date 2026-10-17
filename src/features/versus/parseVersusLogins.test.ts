import { describe, expect, it } from "vitest";
import { parseVersusLogins, versusPath } from "./parseVersusLogins";

describe("parseVersusLogins", () => {
  it("accepts two to five valid logins in order", () => {
    expect(parseVersusLogins(["ada", "grace"])).toEqual(["ada", "grace"]);
    expect(parseVersusLogins(["a", "b", "c", "d", "e"])).toHaveLength(5);
  });

  it("is null for solo, none and more than five", () => {
    expect(parseVersusLogins(["ada"])).toBeNull();
    expect(parseVersusLogins([])).toBeNull();
    expect(parseVersusLogins(["a", "b", "c", "d", "e", "f"])).toBeNull();
  });

  it("drops repeats case-insensitively, keeping the first", () => {
    expect(parseVersusLogins(["ada", "Ada", "grace"])).toEqual([
      "ada",
      "grace",
    ]);
  });

  it("is null when repeats leave fewer than two developers", () => {
    expect(parseVersusLogins(["ada", "ADA"])).toBeNull();
  });

  it("is null when any segment is invalid or reserved", () => {
    expect(parseVersusLogins(["ada", "-bad"])).toBeNull();
    expect(parseVersusLogins(["ada", "lab"])).toBeNull();
    expect(parseVersusLogins(["ada", "API"])).toBeNull();
    expect(parseVersusLogins(["ada", "a%2Fb"])).toBeNull();
    expect(parseVersusLogins(["ada", "%E0%A4%A"])).toBeNull();
  });
});

describe("versusPath", () => {
  it("joins logins into a path", () => {
    expect(versusPath(["ada"])).toBe("/ada");
    expect(versusPath(["ada", "grace"])).toBe("/ada/grace");
  });
});
