import { describe, expect, it } from "vitest";
import { blockAtPointer } from "./explore";

describe("blockAtPointer", () => {
  const rect = { left: 100, width: 200 };
  const shares = [0.5, 0.25, 0.25];

  it("matches blocks by their share of the width", () => {
    expect(blockAtPointer(150, rect, shares)).toBe(0);
    expect(blockAtPointer(210, rect, shares)).toBe(1);
    expect(blockAtPointer(290, rect, shares)).toBe(2);
  });

  it("clamps outside the chart and handles empty input", () => {
    expect(blockAtPointer(0, rect, shares)).toBe(0);
    expect(blockAtPointer(999, rect, shares)).toBe(2);
    expect(blockAtPointer(150, rect, [])).toBe(0);
    expect(blockAtPointer(150, { left: 0, width: 0 }, shares)).toBe(0);
  });
});
