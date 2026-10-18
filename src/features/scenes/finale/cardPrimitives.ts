/**
 * Canvas text primitives for the share cards: fonts, one text style, fitting
 * and wrapping. No layout lives here; see `cardCanvas.ts`.
 */

export type Ctx = CanvasRenderingContext2D;

/** The two chosen fonts, as CSS family lists (next/font hashes the names). */
export type CardFonts = { display: string; mono: string };

/** The families the page already loaded, read from the CSS variables. */
export function readCardFonts(): CardFonts {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    display: read("--font-big-shoulders", "sans-serif"),
    mono: read("--font-martian-mono", "monospace"),
  };
}

/** How long a card waits for the fonts before drawing with what it has. */
const FONT_WAIT_MS = 3000;

/**
 * Waits for both fonts at the weights the cards use, for at most
 * `FONT_WAIT_MS`. It never rejects and never hangs: a card drawn in a fallback
 * font beats no card.
 */
export async function loadCardFonts(fonts: CardFonts): Promise<void> {
  const loaded = Promise.all([
    document.fonts.load(`900 40px ${fonts.display}`),
    document.fonts.load(`800 40px ${fonts.display}`),
    document.fonts.load(`500 12px ${fonts.mono}`),
    document.fonts.load(`700 12px ${fonts.mono}`),
  ]).then(
    () => undefined,
    () => undefined,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FONT_WAIT_MS);
  });
  await Promise.race([loaded, timeout]);
  clearTimeout(timer);
}

export type TextStyle = {
  family: string;
  size: number;
  weight?: number;
  color: string;
  align?: CanvasTextAlign;
  /** Mono labels: 87.5% width and a little tracking, as everywhere else. */
  mono?: boolean;
  upper?: boolean;
};

/** Mono labels are drawn this much wider than their glyphs, in canvas px. */
const LABEL_TRACKING = "0.6px";

export function setFont(ctx: Ctx, style: TextStyle) {
  ctx.font = `${style.weight ?? 400} ${style.size}px ${style.family}`;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? "left";
  ctx.textBaseline = "alphabetic";
  // Both are best effort: a browser without them draws the normal width.
  ctx.fontStretch = style.mono ? "semi-condensed" : "normal";
  ctx.letterSpacing = style.mono && style.upper ? LABEL_TRACKING : "0px";
}

const shown = (value: string, style: TextStyle) =>
  style.upper ? value.toUpperCase() : value;

export function drawText(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  style: TextStyle,
) {
  setFont(ctx, style);
  ctx.fillText(shown(value, style), x, y);
}

/** `value` cut to fit `maxWidth` with an ellipsis, in the style's font. */
export function ellipsize(
  ctx: Ctx,
  value: string,
  maxWidth: number,
  style: TextStyle,
): string {
  setFont(ctx, style);
  const fits = (candidate: string) =>
    ctx.measureText(shown(candidate, style)).width <= maxWidth;
  if (fits(value)) return value;
  let end = value.length;
  while (end > 1 && !fits(`${value.slice(0, end)}…`)) end -= 1;
  return `${value.slice(0, end)}…`;
}

/**
 * The text to draw and its size: shrunk from `style.size` to fit `maxWidth`,
 * never below `minScale` of it. Past that the text is cut with an ellipsis, so
 * a long name stays readable instead of turning into a speck.
 */
export function fitText(
  ctx: Ctx,
  value: string,
  maxWidth: number,
  style: TextStyle,
  minScale: number,
): { value: string; size: number } {
  setFont(ctx, style);
  const width = ctx.measureText(shown(value, style)).width;
  if (width <= maxWidth) return { value, size: style.size };
  const size = Math.max(
    Math.floor(style.size * minScale),
    Math.floor((style.size * maxWidth) / width),
  );
  const smaller = { ...style, size };
  return { value: ellipsize(ctx, value, maxWidth, smaller), size };
}

/** Greedy word wrap, in the style's font. */
export function wrap(
  ctx: Ctx,
  value: string,
  maxWidth: number,
  style: TextStyle,
): string[] {
  setFont(ctx, style);
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
