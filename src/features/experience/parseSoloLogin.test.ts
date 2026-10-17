import { describe, expect, it } from "vitest";
import { parseSoloLogin } from "./parseSoloLogin";

describe("parseSoloLogin", () => {
  it("returns the login for one valid segment", () => {
    expect(parseSoloLogin(["torvalds"])).toBe("torvalds");
    expect(parseSoloLogin(["Ada-Lovelace"])).toBe("Ada-Lovelace");
  });

  it("decodes percent-encoding before validating", () => {
    expect(parseSoloLogin(["tor%76alds"])).toBe("torvalds");
    expect(parseSoloLogin(["a%2Fb"])).toBeNull();
    expect(parseSoloLogin(["%E0%A4%A"])).toBeNull();
  });

  it("is null for versus (several segments) and for none", () => {
    expect(parseSoloLogin(["ada", "grace"])).toBeNull();
    expect(parseSoloLogin([])).toBeNull();
  });

  it("is null for invalid logins", () => {
    expect(parseSoloLogin(["-ada"])).toBeNull();
    expect(parseSoloLogin(["a_b"])).toBeNull();
  });

  it("rejects logins that collide with app routes", () => {
    expect(parseSoloLogin(["lab"])).toBeNull();
    expect(parseSoloLogin(["API"])).toBeNull();
  });
});
