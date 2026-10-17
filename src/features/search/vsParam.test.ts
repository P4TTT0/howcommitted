import { describe, expect, it } from "vitest";
import { parseVsParam } from "./vsParam";

describe("parseVsParam", () => {
  it("returns a valid login when versus is enabled", () => {
    expect(parseVsParam("?vs=ada", true)).toBe("ada");
  });

  it("ignores the param when versus is disabled", () => {
    expect(parseVsParam("?vs=ada", false)).toBeNull();
  });

  it("ignores missing, repeated, invalid and reserved values", () => {
    expect(parseVsParam("", true)).toBeNull();
    expect(parseVsParam("?vs=a&vs=b", true)).toBeNull();
    expect(parseVsParam("?vs=not%20valid!", true)).toBeNull();
    expect(parseVsParam("?vs=lab", true)).toBeNull();
  });
});
