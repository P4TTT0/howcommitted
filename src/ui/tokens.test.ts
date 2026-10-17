import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocks, neutrals, versus } from "./tokens";

const { paper, ink } = neutrals;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` colors. */
function contrastRatio(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

describe("globals.css @theme", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const theme = /@theme\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const declared = new Map(
    [...theme.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [
      m[1],
      m[2]?.toUpperCase(),
    ]),
  );

  const expected = new Map<string, string>([
    ...Object.entries(neutrals),
    ...Object.entries(blocks).map(([k, v]): [string, string] => [
      `block-${k}`,
      v,
    ]),
    ...Object.entries(versus).map(([k, v]): [string, string] => [
      `versus-${k}`,
      v,
    ]),
  ]);

  it.each([...expected])("--color-%s matches the token %s", (name, hex) => {
    expect(declared.get(name)).toBe(hex.toUpperCase());
  });

  it("declares no color without a token", () => {
    expect([...declared.keys()].sort()).toEqual([...expected.keys()].sort());
  });
});
