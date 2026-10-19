import { describe, expect, it } from "vitest";
import { activeAt, slideOffset, stepIndex, swipeStep } from "./carousel";

describe("activeAt", () => {
  const times = [0.5, 1, 1.5];
  it("stays on the first slide before any reveal", () => {
    expect(activeAt(0, times)).toBe(0);
  });
  it("follows the latest revealed slide", () => {
    expect(activeAt(0.5, times)).toBe(0);
    expect(activeAt(1.2, times)).toBe(1);
    expect(activeAt(6, times)).toBe(2);
  });
  it("handles no slides", () => {
    expect(activeAt(3, [])).toBe(0);
  });
});

describe("stepIndex", () => {
  it("clamps at both ends", () => {
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(1, 1, 3)).toBe(2);
    expect(stepIndex(1, -1, 3)).toBe(0);
  });
});

describe("slideOffset", () => {
  it("is zero for the active slide", () => {
    expect(slideOffset(2, 2)).toBe(0);
    expect(slideOffset(0, 2)).toBe(-2);
    expect(slideOffset(3, 2)).toBe(1);
  });
});

describe("swipeStep", () => {
  it("ignores short drags and maps direction", () => {
    expect(swipeStep(-10)).toBe(0);
    expect(swipeStep(-60)).toBe(1);
    expect(swipeStep(60)).toBe(-1);
  });
});
