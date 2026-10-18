import { neutrals } from "@/ui/tokens";
import {
  CARD_SIZE,
  type ErasCard,
  type PosterCard,
  type RhythmCard,
  type ShareCard,
} from "./cards";

/** The two chosen fonts, as CSS family lists (next/font hashes the names). */
export type CardFonts = { display: string; mono: string };

/**
 * Cards are laid out on a 540 x 960 grid and scaled, so a thumbnail and the
 * saved image are the same drawing.
 */
const W = 540;
const H = 960;
const PAD_X = 36;
const PAD_Y = 40;
const INNER = W - PAD_X * 2;

type Ctx = CanvasRenderingContext2D;
type Ink = Pick<ShareCard, "foreground" | "accent">;

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

/** Resolves once both fonts can draw at the weights the cards use. */
export async function loadCardFonts(fonts: CardFonts): Promise<void> {
  await Promise.all([
    document.fonts.load(`900 40px ${fonts.display}`),
    document.fonts.load(`800 40px ${fonts.display}`),
    document.fonts.load(`500 12px ${fonts.mono}`),
    document.fonts.load(`700 12px ${fonts.mono}`),
  ]);
}

type TextStyle = {
  family: string;
  size: number;
  weight?: number;
  color: string;
  align?: CanvasTextAlign;
  /** Mono labels: 87.5% width and a little tracking, as everywhere else. */
  mono?: boolean;
  upper?: boolean;
};

function setFont(ctx: Ctx, style: TextStyle) {
  ctx.font = `${style.weight ?? 400} ${style.size}px ${style.family}`;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? "left";
  ctx.textBaseline = "alphabetic";
  // Both are best effort: a browser without them draws the normal width.
  ctx.fontStretch = style.mono ? "semi-condensed" : "normal";
  ctx.letterSpacing = style.mono && style.upper ? "0.6px" : "0px";
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  style: TextStyle,
): number {
  setFont(ctx, style);
  ctx.fillText(style.upper ? value.toUpperCase() : value, x, y);
  return ctx.measureText(style.upper ? value.toUpperCase() : value).width;
}

/** The largest size, down from `size`, at which `value` fits `maxWidth`. */
function fitSize(
  ctx: Ctx,
  value: string,
  maxWidth: number,
  size: number,
  style: TextStyle,
): number {
  setFont(ctx, { ...style, size });
  const width = ctx.measureText(value).width;
  return width <= maxWidth ? size : Math.floor((size * maxWidth) / width);
}

function ellipsize(ctx: Ctx, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let end = value.length;
  while (end > 1 && ctx.measureText(`${value.slice(0, end)}…`).width > maxWidth)
    end -= 1;
  return `${value.slice(0, end)}…`;
}

/** Greedy word wrap for the mono notes. */
function wrap(ctx: Ctx, value: string, maxWidth: number): string[] {
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

function header(ctx: Ctx, card: ShareCard, fonts: CardFonts) {
  text(ctx, "Committed", PAD_X, PAD_Y + 24, {
    family: fonts.display,
    size: 30,
    weight: 900,
    color: card.foreground,
    upper: true,
  });
  text(ctx, `@${card.login}`, W - PAD_X, PAD_Y + 24, {
    family: fonts.mono,
    size: 12,
    weight: 500,
    color: card.foreground,
    align: "right",
    mono: true,
  });
}

/** Notes then the address, ending at the bottom padding. Returns its top. */
function footer(ctx: Ctx, card: ShareCard, fonts: CardFonts): number {
  const note: TextStyle = {
    family: fonts.mono,
    size: 11,
    weight: 500,
    color: card.foreground,
    mono: true,
  };
  setFont(ctx, note);
  const lines = card.notes.flatMap((value) => wrap(ctx, value, INNER));
  const lineHeight = 16;
  const top = H - PAD_Y - lineHeight * (lines.length + 1) - 8;
  lines.forEach((line, index) => {
    text(ctx, line, PAD_X, top + 12 + index * lineHeight, note);
  });
  text(ctx, card.address, PAD_X, top + 12 + lines.length * lineHeight + 8, {
    ...note,
    weight: 700,
  });
  return top;
}

function label(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  fonts: CardFonts,
  color: string,
  size = 13,
) {
  text(ctx, value, x, y, {
    family: fonts.mono,
    size,
    weight: 500,
    color,
    mono: true,
    upper: true,
  });
}

/** Top of a block of `height` centered between the header and `limit`. */
function centeredTop(limit: number, height: number): number {
  const headerBottom = 96;
  return headerBottom + Math.max(0, (limit - headerBottom - height) / 2);
}

function drawPoster(ctx: Ctx, card: PosterCard, fonts: CardFonts) {
  const bottom = footer(ctx, card, fonts) - 24;
  // Facts: label left, value right, a hairline under all but the last.
  const rowHeight = 56;
  const factsTop = bottom - card.facts.length * rowHeight;
  card.facts.forEach((fact, index) => {
    const baseline = factsTop + index * rowHeight + 38;
    label(ctx, fact.label, PAD_X, baseline - 6, fonts, card.foreground, 12);
    text(ctx, fact.value, W - PAD_X, baseline, {
      family: fonts.display,
      size: 36,
      weight: 900,
      color: card.foreground,
      align: "right",
    });
    if (index < card.facts.length - 1) {
      ctx.fillStyle = card.foreground;
      ctx.fillRect(PAD_X, factsTop + (index + 1) * rowHeight - 6, INNER, 1);
    }
  });

  // One bar per year, tallest at full height, on a ruled baseline.
  const barsBottom = factsTop - 28;
  const barsTop = barsBottom - 190;
  const totalStyle = {
    family: fonts.display,
    size: 180,
    weight: 900,
    color: card.foreground,
  };
  const size = fitSize(ctx, card.total, INNER, 180, totalStyle);
  const heroHeight = 14 + 20 + size * 0.8 + 80;
  const heroTop = centeredTop(barsTop, heroHeight);
  label(ctx, card.range, PAD_X, heroTop + 14, fonts, card.foreground);
  text(ctx, card.total, PAD_X, heroTop + 34 + size * 0.8, {
    ...totalStyle,
    size,
  });
  text(ctx, card.headline, PAD_X, heroTop + 34 + size * 0.8 + 80, {
    family: fonts.display,
    size: 56,
    weight: 800,
    color: card.accent,
    upper: true,
  });

  const height = barsBottom - barsTop;
  const gap = 4;
  const count = Math.max(1, card.bars.length);
  const width = (INNER - gap * (count - 1)) / count;
  card.bars.forEach((bar, index) => {
    const barHeight = Math.max(4, Math.round(bar.ratio * height));
    ctx.fillStyle = bar.color;
    ctx.fillRect(
      PAD_X + index * (width + gap),
      barsBottom - barHeight,
      width,
      barHeight,
    );
  });
  ctx.fillStyle = card.foreground;
  ctx.fillRect(PAD_X, barsBottom, INNER, 2);
}

function drawRhythm(ctx: Ctx, card: RhythmCard, fonts: CardFonts) {
  const bottom = footer(ctx, card, fonts) - 24;

  // Facts as two boxes: paper, then the accent.
  const boxHeight = 84;
  const boxTop = bottom - boxHeight;
  const gap = 16;
  const boxWidth = (INNER - gap) / 2;
  card.facts.slice(0, 2).forEach((fact, index) => {
    const x = PAD_X + index * (boxWidth + gap);
    ctx.fillStyle = index === 0 ? neutrals.paper : card.accent;
    ctx.fillRect(x, boxTop, boxWidth, boxHeight);
    label(ctx, fact.label, x + 16, boxTop + 28, fonts, neutrals.ink, 11);
    const size = fitSize(ctx, fact.value, boxWidth - 32, 48, {
      family: fonts.display,
      size: 48,
      weight: 900,
      color: neutrals.ink,
    });
    text(ctx, fact.value, x + 16, boxTop + 28 + 8 + size * 0.8, {
      family: fonts.display,
      size,
      weight: 900,
      color: neutrals.ink,
    });
  });

  // Seven weekday bars on a ruled baseline, weekend days in the accent.
  const labelsY = Math.floor(boxTop - 28);
  const baseline = labelsY - 20;
  const chartHeight = 190;

  // The archetype, one word per line so a long name stays big.
  const words = card.archetype.split(" ");
  const style = {
    family: fonts.display,
    size: 104,
    weight: 900,
    color: card.foreground,
    upper: true,
  };
  const fitted = Math.min(
    ...words.map((word) => fitSize(ctx, word.toUpperCase(), INNER, 104, style)),
  );
  const heroHeight =
    14 + 24 + fitted * 0.8 + (words.length - 1) * fitted * 0.86 + 8;
  const heroTop = centeredTop(baseline - chartHeight, heroHeight);
  label(ctx, card.kicker, PAD_X, heroTop + 14, fonts, card.foreground);
  words.forEach((word, index) => {
    text(
      ctx,
      word,
      PAD_X,
      heroTop + 38 + fitted * 0.8 + index * fitted * 0.86,
      { ...style, size: fitted },
    );
  });

  const columnGap = 8;
  const column = (INNER - columnGap * 6) / 7;
  card.days.forEach((day, index) => {
    const x = PAD_X + index * (column + columnGap);
    const barHeight = Math.max(4, Math.round(day.ratio * chartHeight));
    ctx.fillStyle = day.weekend ? card.accent : neutrals.paper;
    ctx.fillRect(x, baseline - barHeight, column, barHeight);
    text(ctx, day.short, x + column / 2, labelsY, {
      family: fonts.mono,
      size: 11,
      weight: 500,
      color: card.foreground,
      align: "center",
      mono: true,
      upper: true,
    });
  });
  ctx.fillStyle = card.foreground;
  ctx.fillRect(PAD_X, baseline, INNER, 2);
}

function drawEras(ctx: Ctx, card: ErasCard, fonts: CardFonts) {
  const bottom = footer(ctx, card, fonts) - 20;

  const rowHeight = 40;
  const rowGap = 6;
  const listHeight = card.eras.length * (rowHeight + rowGap);
  const listTop = bottom - listHeight;

  const nameStyle = {
    family: fonts.display,
    size: 120,
    weight: 900,
    color: card.foreground,
  };
  const size = fitSize(ctx, card.repo, INNER, 120, nameStyle);
  const heroHeight = 14 + 14 + size * 0.8 + 60;
  const heroTop = centeredTop(listTop - 40, heroHeight);
  label(ctx, card.kicker, PAD_X, heroTop + 14, fonts, card.foreground);
  text(ctx, card.repo, PAD_X, heroTop + 28 + size * 0.8, {
    ...nameStyle,
    size,
  });
  const mono: TextStyle = {
    family: fonts.mono,
    size: 13,
    weight: 500,
    color: card.foreground,
    mono: true,
  };
  setFont(ctx, mono);
  text(
    ctx,
    ellipsize(ctx, card.detail, INNER),
    PAD_X,
    heroTop + 28 + size * 0.8 + 52,
    mono,
  );

  // Era rows, bottom-anchored above the footer.
  label(ctx, card.heading, PAD_X, listTop - 14, fonts, card.foreground, 12);
  ctx.fillStyle = card.foreground;
  ctx.fillRect(PAD_X, listTop - 8, INNER, 2);
  card.eras.forEach((era, index) => {
    const y = listTop + index * (rowHeight + rowGap);
    ctx.fillStyle = neutrals.paper;
    ctx.fillRect(PAD_X, y, INNER, rowHeight);
    ctx.fillStyle = era.color;
    ctx.fillRect(PAD_X + 10, y + 11, 18, 18);
    const year: TextStyle = {
      family: fonts.display,
      size: 26,
      weight: 900,
      color: neutrals.ink,
    };
    text(ctx, era.year, PAD_X + 40, y + 29, year);
    const mono: TextStyle = {
      family: fonts.mono,
      size: 12,
      weight: 700,
      color: neutrals.ink,
      mono: true,
    };
    setFont(ctx, mono);
    const languageWidth = era.language
      ? ctx.measureText(era.language).width + 12
      : 0;
    if (era.language) {
      text(ctx, era.language, W - PAD_X - 10, y + 25, {
        ...mono,
        weight: 500,
        align: "right",
      });
    }
    setFont(ctx, mono);
    const repo = ellipsize(ctx, era.repo, INNER - 40 - 60 - 10 - languageWidth);
    text(ctx, repo, PAD_X + 100, y + 25, mono);
  });
}

/** Draws `card` onto `canvas`, `width` px wide (the height follows 9:16). */
export function drawCard(
  canvas: HTMLCanvasElement,
  card: ShareCard,
  fonts: CardFonts,
  width: number = CARD_SIZE.width,
): void {
  const scale = width / W;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = card.background;
  ctx.fillRect(0, 0, W, H);
  header(ctx, card, fonts);
  const ink: Ink = card;
  ctx.fillStyle = ink.foreground;
  if (card.kind === "poster") drawPoster(ctx, card, fonts);
  else if (card.kind === "rhythm") drawRhythm(ctx, card, fonts);
  else drawEras(ctx, card, fonts);
}

/** The card as a PNG, full size. */
export async function cardToBlob(
  card: ShareCard,
  fonts: CardFonts,
): Promise<Blob | null> {
  await loadCardFonts(fonts);
  const canvas = document.createElement("canvas");
  drawCard(canvas, card, fonts, CARD_SIZE.width);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
