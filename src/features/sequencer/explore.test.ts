import { describe, expect, it } from "vitest";
import { indexAfterKey, indexAtPointer } from "./explore";

describe("indexAtPointer", () => {
  const rect = { left: 100, width: 400 };

  it("maps a position to one of equal slots", () => {
    expect(indexAtPointer(100, rect, 4)).toBe(0);
    expect(indexAtPointer(199, rect, 4)).toBe(0);
    expect(indexAtPointer(200, rect, 4)).toBe(1);
    expect(indexAtPointer(499, rect, 4)).toBe(3);
  });

  it("clamps outside the chart", () => {
    expect(indexAtPointer(0, rect, 4)).toBe(0);
    expect(indexAtPointer(900, rect, 4)).toBe(3);
  });

  it("is safe with nothing to point at", () => {
    expect(indexAtPointer(150, rect, 0)).toBe(0);
    expect(indexAtPointer(150, { left: 0, width: 0 }, 4)).toBe(0);
  });
});

describe("indexAfterKey", () => {
  it("steps with the arrows and clamps", () => {
    expect(indexAfterKey("ArrowRight", 2, 5)).toBe(3);
    expect(indexAfterKey("ArrowLeft", 2, 5)).toBe(1);
    expect(indexAfterKey("ArrowLeft", 0, 5)).toBe(0);
    expect(indexAfterKey("ArrowRight", 4, 5)).toBe(4);
  });

  it("uses the given step sizes", () => {
    expect(indexAfterKey("ArrowRight", 0, 100, { step: 7 })).toBe(7);
    expect(indexAfterKey("PageDown", 0, 100, { bigStep: 30 })).toBe(30);
    expect(indexAfterKey("PageUp", 10, 100, { bigStep: 30 })).toBe(0);
  });

  it("jumps to the ends", () => {
    expect(indexAfterKey("Home", 3, 5)).toBe(0);
    expect(indexAfterKey("End", 1, 5)).toBe(4);
  });

  it("returns null for other keys and empty charts", () => {
    expect(indexAfterKey("a", 1, 5)).toBeNull();
    expect(indexAfterKey("ArrowRight", 0, 0)).toBeNull();
  });
});
