/** Design tokens from docs/design.md. The same values live in globals.css. */

export const neutrals = {
  paper: "#F3F1EC",
  ink: "#141414",
} as const;

export const blocks = {
  ultramarine: "#1F3BFF",
  safety: "#FF5B1F",
  forest: "#0B6B43",
  signal: "#FFD23F",
  violet: "#7A1FD1",
  pink: "#FF6FA8",
} as const;

export const versus = {
  p1: "#1F3BFF",
  p2: "#E0218A",
  p3: "#A88000",
  p4: "#0B6B43",
  p5: "#1E88E5",
} as const;

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
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
