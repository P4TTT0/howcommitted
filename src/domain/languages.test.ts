import { describe, expect, it } from "vitest";
import { languageShares } from "./languages";
import type { Repo } from "./types";

describe("languageShares", () => {
  const repo = (languages: Repo["languages"]): Repo => ({
    name: "r",
    createdAt: "2020-01-01T00:00:00Z",
    stars: 0,
    languages,
  });

  it("returns top 5 plus other", () => {
    const shares = languageShares([
      repo([
        { name: "A", size: 60 },
        { name: "B", size: 50 },
        { name: "C", size: 40 },
        { name: "D", size: 30 },
        { name: "E", size: 20 },
        { name: "F", size: 5 },
        { name: "G", size: 5 },
      ]),
    ]);
    expect(shares.map((s) => s.name)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "Other",
    ]);
    const other = shares[5];
    expect(other?.size).toBe(10);
    expect(other?.isOther).toBe(true);
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it("omits other with exactly five languages", () => {
    const shares = languageShares([
      repo(["A", "B", "C", "D", "E"].map((name) => ({ name, size: 10 }))),
    ]);
    expect(shares).toHaveLength(5);
    expect(shares.some((s) => s.isOther)).toBe(false);
  });

  it("folds the sixth language into other", () => {
    const shares = languageShares([
      repo(
        ["A", "B", "C", "D", "E", "F"].map((name, i) => ({
          name,
          size: 60 - i * 10,
        })),
      ),
    ]);
    expect(shares).toHaveLength(6);
    expect(shares[5]).toMatchObject({ name: "Other", size: 10, isOther: true });
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it("breaks size ties by name", () => {
    const shares = languageShares([
      repo([
        { name: "Zig", size: 10 },
        { name: "Ada", size: 10 },
      ]),
    ]);
    expect(shares.map((s) => s.name)).toEqual(["Ada", "Zig"]);
  });

  it("merges the same language across repos and omits other when unused", () => {
    const shares = languageShares([
      repo([{ name: "TS", size: 10 }]),
      repo([{ name: "TS", size: 30 }]),
    ]);
    expect(shares).toEqual([
      { name: "TS", size: 40, share: 1, isOther: false },
    ]);
  });

  it("returns nothing without language data", () => {
    expect(languageShares([repo([])])).toEqual([]);
  });
});
