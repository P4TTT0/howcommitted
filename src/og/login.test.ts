import { describe, expect, it } from "vitest";
import { imageLogin, imagePath } from "./login";

describe("imageLogin", () => {
  it("accepts a valid login", () => {
    expect(imageLogin("torvalds")).toBe("torvalds");
    expect(imageLogin("Octo-Cat")).toBe("Octo-Cat");
  });

  it("falls back to generic for invalid and reserved logins", () => {
    expect(imageLogin("-bad")).toBeNull();
    expect(imageLogin("a".repeat(40))).toBeNull();
    expect(imageLogin("a/b")).toBeNull();
    expect(imageLogin("")).toBeNull();
    expect(imageLogin("LAB")).toBeNull();
    expect(imageLogin("api")).toBeNull();
  });
});

describe("imagePath", () => {
  it("points at the image route", () => {
    expect(imagePath("octo")).toBe("/api/og/octo");
  });
});
