import { describe, expect, it } from "vitest";
import { crossingCount, crossingsUpTo, findCrossings } from "./crossings";

describe("findCrossings", () => {
  it("finds the day a line passes another", () => {
    expect(
      findCrossings([
        [5, 6, 7, 8],
        [1, 4, 8, 12],
      ]),
    ).toEqual([{ index: 2, passer: 1, passed: 0 }]);
  });

  it("does not count a start from zero as a pass", () => {
    expect(
      findCrossings([
        [0, 0, 3, 4],
        [2, 3, 3, 3],
      ]),
    ).toEqual([{ index: 3, passer: 0, passed: 1 }]);
  });

  it("does not count a tie that falls back", () => {
    expect(
      findCrossings([
        [1, 2, 3, 3],
        [0, 2, 2, 2],
      ]),
    ).toEqual([]);
  });

  it("counts every swap in both directions", () => {
    expect(
      findCrossings([
        [3, 1, 5],
        [1, 4, 2],
      ]),
    ).toEqual([
      { index: 1, passer: 1, passed: 0 },
      { index: 2, passer: 0, passed: 1 },
    ]);
  });

  it("handles three lines", () => {
    const crossings = findCrossings([
      [1, 1, 1],
      [0, 2, 2],
      [0, 0, 3],
    ]);
    expect(crossings.map((c) => [c.index, c.passer, c.passed])).toEqual([
      [1, 1, 0],
      [2, 2, 0],
      [2, 2, 1],
    ]);
  });

  it("returns nothing for fewer than two lines", () => {
    expect(findCrossings([[1, 2, 3]])).toEqual([]);
    expect(findCrossings([])).toEqual([]);
  });
});

describe("crossingsUpTo / crossingCount", () => {
  const all = [
    { index: 1, passer: 1, passed: 0 },
    { index: 4, passer: 0, passed: 1 },
    { index: 9, passer: 1, passed: 0 },
  ];
  it("keeps the latest crossings so far", () => {
    expect(crossingsUpTo(all, 5, 1)).toEqual([all[1]]);
    expect(crossingsUpTo(all, 9, 5)).toEqual(all);
    expect(crossingsUpTo(all, 0, 3)).toEqual([]);
  });
  it("counts those at or before the index", () => {
    expect(crossingCount(all, 4)).toBe(2);
    expect(crossingCount(all, 0)).toBe(0);
  });
});
