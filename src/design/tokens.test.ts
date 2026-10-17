import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocks, contrastRatio, neutrals, versus } from "./tokens";

const { paper, ink } = neutrals;

describe("block palette", () => {
  // Text color and ratio per block, as documented in docs/design.md.
  const documented = [
    ["ultramarine", paper, 5.95],
    ["safety", ink, 5.94],
    ["forest", paper, 5.82],
    ["signal", ink, 12.76],
    ["violet", paper, 6.32],
    ["pink", ink, 7.1],
  ] as const;

  it.each(documented)(
    "%s text meets the documented contrast",
    (name, text, ratio) => {
      expect(contrastRatio(blocks[name], text)).toBeCloseTo(ratio, 1);
    },
  );
});

describe("versus palette", () => {
  it.each(Object.entries(versus))(
    "%s is readable as a line on paper (3:1)",
    (_, color) => {
      expect(contrastRatio(color, paper)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("globals.css", () => {
  const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();

  it.each([
    ...Object.entries(neutrals),
    ...Object.entries(blocks),
    ...Object.entries(versus),
  ])("declares %s as %s", (_, hex) => {
    expect(css).toContain(hex.toLowerCase());
  });
});
