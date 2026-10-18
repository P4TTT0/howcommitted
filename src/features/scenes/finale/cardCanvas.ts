import { MIN_NAME_SCALE } from "@/features/scenes/main-repo/plan";
import { neutrals } from "@/ui/tokens";
import {
  type CardFonts,
  type Ctx,
  drawText,
  ellipsize,
  fitText,
  setFont,
  type TextStyle,
  wrap,
} from "./cardPrimitives";
import {
  CARD_SIZE,
  type ErasCard,
  type PosterCard,
  type RhythmCard,
  type ShareCard,
} from "./cards";

/**
 * The three card layouts. Cards are laid out on a grid half the saved size and
 * scaled, so a thumbnail and the saved image are the same drawing. Every
 * vertical offset below comes from the named constants, and each block's
 * height is computed from the same numbers it is drawn with.
 */
const GRID = 2;
const W = CARD_SIZE.width / GRID;
const H = CARD_SIZE.height / GRID;
const PAD_X = 36;
const PAD_Y = 40;
const INNER = W - PAD_X * 2;

/** Nothing but the header sits above this line. */
const HEADER_BOTTOM = 96;
const HEADER_BASELINE = PAD_Y + 24;
/** Gap kept between stacked blocks. */
const BLOCK_GAP = 24;
/** Baseline of a Big Shoulders line sits this share of its size below its top. */
const CAP_HEIGHT = 0.8;
/** Advance between stacked lines of the giant type, as a share of its size. */
const LINE_ADVANCE = 0.86;
/** The tallest a card's bar chart gets, and the least it may shrink to. */
const CHART_HEIGHT = 190;
const MIN_CHART_HEIGHT = 48;
/** Distance from a mono label's top to its baseline. */
const LABEL_ASCENT = 14;
/** Space between a label and the giant type under it. */
const LABEL_TO_TYPE = 24;

const FOOTER_LINE = 16;
const ROW_HEIGHT = 40;
const ROW_GAP = 6;

const display = (
  fonts: CardFonts,
  size: number,
  color: string,
  weight = 900,
): TextStyle => ({ family: fonts.display, size, weight, color });

const mono = (
  fonts: CardFonts,
  size: number,
  color: string,
  weight = 500,
): TextStyle => ({ family: fonts.mono, size, weight, color, mono: true });

const label = (fonts: CardFonts, color: string, size = 13): TextStyle => ({
  ...mono(fonts, size, color),
  upper: true,
});

function header(ctx: Ctx, card: ShareCard, fonts: CardFonts) {
  const name = { ...display(fonts, 30, card.foreground), upper: true };
  drawText(ctx, "Committed", PAD_X, HEADER_BASELINE, name);
  const login = {
    ...mono(fonts, 12, card.foreground),
    align: "right" as const,
  };
  // The wordmark keeps its room; a long login is cut, never overlapped.
  setFont(ctx, name);
  const room = INNER - ctx.measureText("COMMITTED").width - BLOCK_GAP;
  drawText(
    ctx,
    ellipsize(ctx, `@${card.login}`, room, login),
    W - PAD_X,
    HEADER_BASELINE,
    login,
  );
}

/** Notes then the address, ending at the bottom padding. Returns its top. */
function footer(ctx: Ctx, card: ShareCard, fonts: CardFonts): number {
  const note = mono(fonts, 11, card.foreground);
  const lines = card.notes.flatMap((value) => wrap(ctx, value, INNER, note));
  const top = H - PAD_Y - FOOTER_LINE * (lines.length + 1) - 8;
  lines.forEach((line, index) => {
    drawText(ctx, line, PAD_X, top + 12 + index * FOOTER_LINE, note);
  });
  const address = { ...note, weight: 700 };
  drawText(
    ctx,
    ellipsize(ctx, card.address, INNER, address),
    PAD_X,
    top + 12 + lines.length * FOOTER_LINE + 8,
    address,
  );
  return top;
}

/** Top of a block of `height` centered between the header and `limit`. */
function centeredTop(limit: number, height: number): number {
  return HEADER_BOTTOM + Math.max(0, (limit - HEADER_BOTTOM - height) / 2);
}

/** Largest giant-type size, from `size`, whose block still fits `room`. */
function sizeForRoom(
  size: number,
  room: number,
  fixed: number,
  lines: number,
): number {
  const perSize = CAP_HEIGHT + (lines - 1) * LINE_ADVANCE;
  return Math.min(size, Math.max(1, Math.floor((room - fixed) / perSize)));
}

function drawPoster(ctx: Ctx, card: PosterCard, fonts: CardFonts) {
  const bottom = footer(ctx, card, fonts) - BLOCK_GAP;
  // Facts: label left, value right, a hairline under all but the last.
  const rowHeight = 56;
  const factsTop = bottom - card.facts.length * rowHeight;
  card.facts.forEach((fact, index) => {
    const baseline = factsTop + index * rowHeight + 38;
    drawText(
      ctx,
      fact.label,
      PAD_X,
      baseline - 6,
      label(fonts, card.foreground, 12),
    );
    const value = fitText(
      ctx,
      fact.value,
      INNER / 2,
      display(fonts, 36, card.foreground),
      MIN_NAME_SCALE,
    );
    drawText(ctx, value.value, W - PAD_X, baseline, {
      ...display(fonts, value.size, card.foreground),
      align: "right",
    });
    if (index < card.facts.length - 1) {
      ctx.fillStyle = card.foreground;
      ctx.fillRect(PAD_X, factsTop + (index + 1) * rowHeight - 6, INNER, 1);
    }
  });

  // The hero: range label, the total, the headline under it.
  const barsBottom = factsTop - BLOCK_GAP;
  const headlineSize = 56;
  const headlineDrop = headlineSize + BLOCK_GAP;
  const total = fitText(
    ctx,
    card.total,
    INNER,
    display(fonts, 180, card.foreground),
    MIN_NAME_SCALE,
  );
  const numberTop = LABEL_ASCENT + LABEL_TO_TYPE;
  const heroHeight = numberTop + total.size * CAP_HEIGHT + headlineDrop;
  const chartHeight = Math.max(
    MIN_CHART_HEIGHT,
    Math.min(CHART_HEIGHT, barsBottom - HEADER_BOTTOM - heroHeight - BLOCK_GAP),
  );
  const barsTop = barsBottom - chartHeight;
  const heroTop = centeredTop(barsTop, heroHeight);
  drawText(
    ctx,
    card.range,
    PAD_X,
    heroTop + LABEL_ASCENT,
    label(fonts, card.foreground),
  );
  const totalBaseline = heroTop + numberTop + total.size * CAP_HEIGHT;
  drawText(
    ctx,
    total.value,
    PAD_X,
    totalBaseline,
    display(fonts, total.size, card.foreground),
  );
  drawText(ctx, card.headline, PAD_X, totalBaseline + headlineDrop, {
    ...display(fonts, headlineSize, card.accent, 800),
    upper: true,
  });

  // One bar per year, tallest at full height, on a ruled baseline.
  const gap = 4;
  const count = Math.max(1, card.bars.length);
  const width = (INNER - gap * (count - 1)) / count;
  card.bars.forEach((bar, index) => {
    const barHeight = Math.max(4, Math.round(bar.ratio * chartHeight));
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
  const bottom = footer(ctx, card, fonts) - BLOCK_GAP;

  // Facts as two boxes: paper, then the accent.
  const boxHeight = 84;
  const boxTop = bottom - boxHeight;
  const boxGap = 16;
  const boxWidth = (INNER - boxGap) / 2;
  card.facts.slice(0, 2).forEach((fact, index) => {
    const x = PAD_X + index * (boxWidth + boxGap);
    ctx.fillStyle = index === 0 ? neutrals.paper : card.accent;
    ctx.fillRect(x, boxTop, boxWidth, boxHeight);
    drawText(ctx, fact.label, x + 16, boxTop + 28, {
      ...label(fonts, neutrals.ink, 11),
    });
    const value = fitText(
      ctx,
      fact.value,
      boxWidth - 32,
      display(fonts, 48, neutrals.ink),
      MIN_NAME_SCALE,
    );
    drawText(
      ctx,
      value.value,
      x + 16,
      boxTop + 28 + 8 + value.size * CAP_HEIGHT,
      display(fonts, value.size, neutrals.ink),
    );
  });

  // Seven weekday bars on a ruled baseline, weekend days in the accent.
  const labelsY = Math.floor(boxTop - BLOCK_GAP - 4);
  const baseline = labelsY - 20;
  const chartTop = baseline - CHART_HEIGHT;

  // The archetype, one word per line so a long name stays big.
  const words = card.archetype.split(" ");
  const heroFixed = LABEL_ASCENT + LABEL_TO_TYPE + BLOCK_GAP;
  const wordStyle = { ...display(fonts, 104, card.foreground), upper: true };
  const wordSize = Math.min(
    sizeForRoom(
      wordStyle.size,
      chartTop - HEADER_BOTTOM - BLOCK_GAP,
      heroFixed,
      words.length,
    ),
    ...words.map(
      (word) => fitText(ctx, word, INNER, wordStyle, MIN_NAME_SCALE).size,
    ),
  );
  const heroHeight =
    heroFixed + wordSize * (CAP_HEIGHT + (words.length - 1) * LINE_ADVANCE);
  const heroTop = centeredTop(chartTop - BLOCK_GAP, heroHeight);
  drawText(
    ctx,
    card.kicker,
    PAD_X,
    heroTop + LABEL_ASCENT,
    label(fonts, card.foreground),
  );
  words.forEach((word, index) => {
    const fitted = fitText(
      ctx,
      word,
      INNER,
      { ...wordStyle, size: wordSize },
      MIN_NAME_SCALE,
    );
    drawText(
      ctx,
      fitted.value,
      PAD_X,
      heroTop +
        LABEL_ASCENT +
        LABEL_TO_TYPE +
        wordSize * CAP_HEIGHT +
        index * wordSize * LINE_ADVANCE,
      { ...wordStyle, size: wordSize },
    );
  });

  const columnGap = 8;
  const column = (INNER - columnGap * 6) / 7;
  card.days.forEach((day, index) => {
    const x = PAD_X + index * (column + columnGap);
    const barHeight = Math.max(4, Math.round(day.ratio * CHART_HEIGHT));
    ctx.fillStyle = day.weekend ? card.accent : neutrals.paper;
    ctx.fillRect(x, baseline - barHeight, column, barHeight);
    drawText(ctx, day.short, x + column / 2, labelsY, {
      ...label(fonts, card.foreground, 11),
      align: "center",
    });
  });
  ctx.fillStyle = card.foreground;
  ctx.fillRect(PAD_X, baseline, INNER, 2);
}

function drawEras(ctx: Ctx, card: ErasCard, fonts: CardFonts) {
  const bottom = footer(ctx, card, fonts) - BLOCK_GAP;

  // Era rows, bottom-anchored above the footer.
  const listHeight = card.eras.length * (ROW_HEIGHT + ROW_GAP);
  const listTop = bottom - listHeight;
  const headingBaseline = listTop - 14;

  // The hero: kicker, the repository name, one detail line.
  const detail = mono(fonts, 13, card.foreground);
  const detailDrop = BLOCK_GAP + 28;
  const heroFixed = LABEL_ASCENT + LABEL_TO_TYPE + detailDrop;
  const room = headingBaseline - 20 - BLOCK_GAP - HEADER_BOTTOM;
  const name = fitText(
    ctx,
    card.repo,
    INNER,
    display(fonts, sizeForRoom(120, room, heroFixed, 1), card.foreground),
    MIN_NAME_SCALE,
  );
  const heroHeight = heroFixed + name.size * CAP_HEIGHT;
  const heroTop = centeredTop(headingBaseline - 20, heroHeight);
  drawText(
    ctx,
    card.kicker,
    PAD_X,
    heroTop + LABEL_ASCENT,
    label(fonts, card.foreground),
  );
  const nameBaseline =
    heroTop + LABEL_ASCENT + LABEL_TO_TYPE + name.size * CAP_HEIGHT;
  drawText(
    ctx,
    name.value,
    PAD_X,
    nameBaseline,
    display(fonts, name.size, card.foreground),
  );
  drawText(
    ctx,
    ellipsize(ctx, card.detail, INNER, detail),
    PAD_X,
    nameBaseline + detailDrop,
    detail,
  );

  drawText(
    ctx,
    card.heading,
    PAD_X,
    headingBaseline,
    label(fonts, card.foreground, 12),
  );
  ctx.fillStyle = card.foreground;
  ctx.fillRect(PAD_X, listTop - 8, INNER, 2);

  const yearStyle = display(fonts, 26, neutrals.ink);
  const repoStyle = mono(fonts, 12, neutrals.ink, 700);
  const languageStyle = {
    ...mono(fonts, 12, neutrals.ink),
    align: "right" as const,
  };
  card.eras.forEach((era, index) => {
    const y = listTop + index * (ROW_HEIGHT + ROW_GAP);
    ctx.fillStyle = neutrals.paper;
    ctx.fillRect(PAD_X, y, INNER, ROW_HEIGHT);
    ctx.fillStyle = era.color;
    ctx.fillRect(PAD_X + 10, y + 11, 18, 18);
    drawText(ctx, era.year, PAD_X + 40, y + 29, yearStyle);
    setFont(ctx, languageStyle);
    const languageWidth = era.language
      ? ctx.measureText(era.language).width + 12
      : 0;
    if (era.language) {
      drawText(ctx, era.language, W - PAD_X - 10, y + 25, languageStyle);
    }
    const repoRoom = INNER - 40 - 60 - 10 - languageWidth;
    drawText(
      ctx,
      ellipsize(ctx, era.repo, repoRoom, repoStyle),
      PAD_X + 100,
      y + 25,
      repoStyle,
    );
  });
}

/**
 * Draws `card` onto `canvas`, `width` px wide (the height follows 9:16).
 * Returns false when the browser gave no 2D context: nothing was drawn and the
 * caller must not treat the canvas as a card.
 */
export function drawCard(
  canvas: HTMLCanvasElement,
  card: ShareCard,
  fonts: CardFonts,
  width: number = CARD_SIZE.width,
): boolean {
  const scale = width / W;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = card.background;
  ctx.fillRect(0, 0, W, H);
  header(ctx, card, fonts);
  if (card.kind === "poster") drawPoster(ctx, card, fonts);
  else if (card.kind === "rhythm") drawRhythm(ctx, card, fonts);
  else drawEras(ctx, card, fonts);
  return true;
}

/**
 * The card as a full-size PNG, or null when it could not be drawn or encoded.
 * The scratch canvas is released either way. Fonts must already be loaded
 * (see `loadCardFonts`): this runs ahead of the click that saves it.
 */
export async function cardToBlob(
  card: ShareCard,
  fonts: CardFonts,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  try {
    if (!drawCard(canvas, card, fonts, CARD_SIZE.width)) return null;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
