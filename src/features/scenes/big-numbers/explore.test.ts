import { describe, expect, it } from "vitest";
import { indexAtPointer } from "@/features/sequencer/explore";

describe("year chart pointer mapping", () => {
  // 16 years (2011-2026) across a 144px chart on a 360px phone, starting at x=100.
  const rect = { left: 100, width: 144 };

  it("snaps the pointer to the column under it", () => {
    expect(indexAtPointer(100, rect, 16)).toBe(0);
    expect(indexAtPointer(100 + 9 * 5 + 4, rect, 16)).toBe(5);
    expect(indexAtPointer(100 + 144 - 1, rect, 16)).toBe(15);
  });

  it("clamps a scrub that leaves the chart to the first and last year", () => {
    expect(indexAtPointer(-50, rect, 16)).toBe(0);
    expect(indexAtPointer(900, rect, 16)).toBe(15);
  });
});
