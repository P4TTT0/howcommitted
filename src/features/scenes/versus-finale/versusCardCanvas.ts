import { blocks, neutrals } from "@/ui/tokens";
import {
  type CardFonts,
  type Ctx,
  drawText,
  ellipsize,
  fitText,
  setFont,
  type TextStyle,
  wrap,
} from "../finale/cardPrimitives";
import {
  type CardPerson,
  type HabitsCard,
  type RaceCard,
  type TogetherCard,
  VERSUS_CARD_SIZE,
  type VersusCard,
} from "./versusCards";

/**
 * The three versus card layouts, on a grid half the saved size and scaled, so
 * a thumbnail and the saved image are the same drawing. Avatars are the
 * initial in a circle: drawing a remote image would taint the canvas.
 */
const GRID = 2;
const W = VERSUS_CARD_SIZE.width / GRID;
const H = VERSUS_CARD_SIZE.height / GRID;
const PAD = 36;
const INNER = W - PAD * 2;
const CAP = 0.8;
const FOOTER_LINE = 16;
const GAP = 22;

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

/** A paper circle holding the developer's initial. */
function avatar(
  ctx: Ctx,
  person: CardPerson,
  fonts: CardFonts,
  cx: number,
  cy: number,
  radius: number,
  fill: string = neutrals.paper,
  ink: string = neutrals.ink,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  const size = Math.round(radius * 1.1);
  drawText(ctx, person.initial, cx, cy + size * 0.36, {
    ...display(fonts, size, ink),
    align: "center",
  });
}

/** Header row: the wordmark left, `right` in mono on the right. */
function header(
  ctx: Ctx,
  fonts: CardFonts,
  color: string,
  right: string,
): number {
  const baseline = PAD + 22;
  const name = { ...display(fonts, 26, color), upper: true };
  drawText(ctx, "Committed", PAD, baseline, name);
  setFont(ctx, name);
  const room = INNER - ctx.measureText("COMMITTED").width - GAP;
  const style = { ...mono(fonts, 12, color), align: "right" as const };
  drawText(ctx, ellipsize(ctx, right, room, style), W - PAD, baseline, style);
  return baseline;
}

/** Notes and the address under them, ending at the bottom padding. Returns its top. */
function footer(ctx: Ctx, card: VersusCard, fonts: CardFonts): number {
  const note = mono(fonts, 11, card.foreground);
  const lines = card.notes.flatMap((value) => wrap(ctx, value, INNER, note));
  const top = H - PAD - FOOTER_LINE * (lines.length + 1) - 4;
  lines.forEach((line, index) => {
    drawText(ctx, line, PAD, top + 12 + index * FOOTER_LINE, note);
  });
  const address = { ...note, weight: 700 };
  drawText(
    ctx,
    "howcommitted.com",
    PAD,
    top + 12 + lines.length * FOOTER_LINE + 4,
    address,
  );
  return top;
}

function drawTogether(ctx: Ctx, card: TogetherCard, fonts: CardFonts) {
  const top = header(ctx, fonts, card.foreground, card.span);
  const lineupStyle = { ...mono(fonts, 14, card.foreground), upper: true };
  const lineupY = top + GAP + 14;
  drawText(
    ctx,
    ellipsize(ctx, card.lineup, INNER, lineupStyle),
    PAD,
    lineupY,
    lineupStyle,
  );

  const total = fitText(
    ctx,
    card.total,
    INNER,
    display(fonts, 150, card.foreground),
    0.4,
  );
  const totalY = lineupY + GAP + total.size * CAP;
  drawText(
    ctx,
    total.value,
    PAD,
    totalY,
    display(fonts, total.size, card.foreground),
  );
  const headline = fitText(
    ctx,
    card.headline,
    INNER,
    { ...display(fonts, 44, blocks.signal), upper: true },
    0.5,
  );
  const headlineY = totalY + 8 + headline.size * CAP;
  drawText(ctx, headline.value, PAD, headlineY, {
    ...display(fonts, headline.size, blocks.signal),
    upper: true,
  });

  const bottom = footer(ctx, card, fonts) - GAP;
  const bandsTop = headlineY + GAP;
  const gap = 6;
  const count = Math.max(1, card.bands.length);
  const room = bottom - bandsTop - gap * (count - 1);
  const least = Math.min(96, room / count);
  const spare = room - least * count;
  let y = bandsTop;
  for (const band of card.bands) {
    const height = least + spare * band.share;
    ctx.fillStyle = band.color;
    ctx.fillRect(PAD, y, INNER, height);

    avatar(ctx, band, fonts, PAD + 18 + 20, y + 16 + 20, 20);
    const total = fitText(
      ctx,
      band.totalText,
      INNER * 0.5,
      display(fonts, 52, band.onColor),
      0.4,
    );
    drawText(ctx, total.value, W - PAD - 18, y + 16 + total.size * 0.85, {
      ...display(fonts, total.size, band.onColor),
      align: "right",
    });
    const nameStyle = mono(fonts, 15, band.onColor, 700);
    const nameRoom = INNER - 18 - 40 - 10 - 18 - 12 - INNER * 0.5;
    drawText(
      ctx,
      ellipsize(ctx, `@${band.login}`, Math.max(60, nameRoom), nameStyle),
      PAD + 18 + 40 + 10,
      y + 16 + 25,
      nameStyle,
    );
    if (band.awards) {
      const awardStyle = { ...mono(fonts, 12, band.onColor), upper: true };
      drawText(
        ctx,
        ellipsize(ctx, band.awards, INNER - 36, awardStyle),
        PAD + 18,
        y + height - 16,
        awardStyle,
      );
    }
    y += height + gap;
  }
}

function drawRace(ctx: Ctx, card: RaceCard, fonts: CardFonts) {
  const top = header(ctx, fonts, card.foreground, card.lineup);
  const headline = fitText(
    ctx,
    card.headline,
    INNER,
    { ...display(fonts, 110, card.foreground), upper: true },
    0.5,
  );
  const headlineY = top + GAP + headline.size * CAP;
  drawText(ctx, headline.value, PAD, headlineY, {
    ...display(fonts, headline.size, card.foreground),
    upper: true,
  });

  const ruleY = headlineY + GAP;
  ctx.fillStyle = card.foreground;
  ctx.fillRect(PAD, ruleY, INNER, 3);

  // The passes chip sits on the right; the years take what is left.
  const chip = { ...display(fonts, 26, card.background), upper: true };
  setFont(ctx, chip);
  const chipWidth = ctx.measureText(card.passes.toUpperCase()).width + 24;
  const years = fitText(
    ctx,
    card.years,
    INNER - chipWidth - 12,
    display(fonts, 64, card.foreground),
    0.5,
  );
  const yearsY = ruleY + 12 + years.size * CAP;
  drawText(
    ctx,
    years.value,
    PAD,
    yearsY,
    display(fonts, years.size, card.foreground),
  );
  const chipHeight = 26 * CAP + 16;
  ctx.fillStyle = card.foreground;
  ctx.fillRect(
    W - PAD - chipWidth,
    yearsY - chipHeight + 4,
    chipWidth,
    chipHeight,
  );
  drawText(ctx, card.passes, W - PAD - 12, yearsY - 8 + 4, {
    ...chip,
    align: "right",
  });

  const bottom = footer(ctx, card, fonts) - GAP;
  const areaTop = yearsY + GAP;
  const count = Math.max(1, card.bars.length);
  const rowHeight = Math.min(120, (bottom - areaTop) / count);
  const barHeight = Math.max(20, Math.min(56, rowHeight - 36));
  const plot = INNER - 100;
  const block = rowHeight * count;
  let y = areaTop + Math.max(0, (bottom - areaTop - block) / 2);
  for (const bar of card.bars) {
    const nameStyle = mono(fonts, 14, card.foreground, 700);
    drawText(
      ctx,
      ellipsize(ctx, `@${bar.login}`, INNER, nameStyle),
      PAD,
      y + 14,
      nameStyle,
    );
    const barTop = y + 24;
    const width = bar.length * plot;
    ctx.fillStyle = bar.color;
    ctx.fillRect(PAD, barTop, width, barHeight);
    const radius = Math.min(33, barHeight * 0.6);
    const cx = PAD + width;
    const cy = barTop + barHeight / 2;
    ctx.fillStyle = card.foreground;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = card.background;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    avatar(ctx, bar, fonts, cx, cy, radius - 4, bar.color, bar.onColor);
    const textX = cx + radius + 10;
    const total = fitText(
      ctx,
      bar.totalText,
      W - PAD - textX,
      display(fonts, 40, card.foreground),
      0.4,
    );
    drawText(
      ctx,
      total.value,
      textX,
      cy + total.size * 0.35,
      display(fonts, total.size, card.foreground),
    );
    y += rowHeight;
  }
}

function drawHabits(ctx: Ctx, card: HabitsCard, fonts: CardFonts) {
  const top = header(ctx, fonts, card.foreground, card.lineup);
  const headline = fitText(
    ctx,
    card.headline,
    INNER,
    { ...display(fonts, 110, card.foreground), upper: true },
    0.5,
  );
  const headlineY = top + GAP + headline.size * CAP;
  drawText(ctx, headline.value, PAD, headlineY, {
    ...display(fonts, headline.size, card.foreground),
    upper: true,
  });

  const bottom = footer(ctx, card, fonts) - GAP;
  const areaTop = headlineY + GAP;
  const gap = 8;
  const count = Math.max(1, card.rows.length);
  const rowHeight = (bottom - areaTop - gap * (count - 1)) / count;
  const side = 120;
  const unit = 50;
  const fits = Math.max(1, Math.floor((rowHeight - 20) / unit));
  card.rows.forEach((row, index) => {
    const y = areaTop + index * (rowHeight + gap);
    ctx.fillStyle = neutrals.paper;
    ctx.fillRect(PAD, y, INNER, rowHeight);
    ctx.fillStyle = row.color;
    ctx.fillRect(PAD, y, side, rowHeight);
    ctx.strokeStyle = card.foreground;
    ctx.lineWidth = 3;
    ctx.strokeRect(PAD + 1.5, y + 1.5, INNER - 3, rowHeight - 3);

    const radius = Math.min(32, (rowHeight - 36) / 2);
    const cx = PAD + side / 2;
    const cy = y + rowHeight / 2 - 10;
    avatar(ctx, row, fonts, cx, cy, radius);
    const nameStyle = {
      ...mono(fonts, 12, row.onColor, 700),
      align: "center" as const,
    };
    drawText(
      ctx,
      ellipsize(ctx, `@${row.login}`, side - 16, nameStyle),
      cx,
      cy + radius + 20,
      nameStyle,
    );

    const shown = row.awards.slice(0, fits);
    const textX = PAD + side + 18;
    const room = INNER - side - 36;
    const blockHeight = shown.length * unit - 10;
    let lineY = y + (rowHeight - blockHeight) / 2;
    if (shown.length === 0) {
      const none = mono(fonts, 11, card.foreground);
      drawText(
        ctx,
        "Nothing to name this time",
        textX,
        y + rowHeight / 2 + 4,
        none,
      );
    }
    for (const award of shown) {
      const title = fitText(
        ctx,
        award.title,
        room,
        { ...display(fonts, 32, card.foreground), upper: true },
        0.6,
      );
      drawText(ctx, title.value, textX, lineY + title.size * CAP, {
        ...display(fonts, title.size, card.foreground),
        upper: true,
      });
      const valueStyle = mono(fonts, 11, card.foreground);
      drawText(
        ctx,
        ellipsize(ctx, award.value, room, valueStyle),
        textX,
        lineY + title.size * CAP + 16,
        valueStyle,
      );
      lineY += unit;
    }
  });
}

/**
 * Draws `card` onto `canvas`, `width` px wide (the height follows 9:16).
 * Returns false when the browser gave no 2D context.
 */
export function drawVersusCard(
  canvas: HTMLCanvasElement,
  card: VersusCard,
  fonts: CardFonts,
  width: number = VERSUS_CARD_SIZE.width,
): boolean {
  const scale = width / W;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = card.background;
  ctx.fillRect(0, 0, W, H);
  if (card.kind === "together") drawTogether(ctx, card, fonts);
  else if (card.kind === "race") drawRace(ctx, card, fonts);
  else drawHabits(ctx, card, fonts);
  return true;
}

/**
 * The card as a full-size PNG, or null when it could not be drawn or encoded.
 * Fonts must already be loaded (see `loadCardFonts`).
 */
export async function versusCardToBlob(
  card: VersusCard,
  fonts: CardFonts,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  try {
    if (!drawVersusCard(canvas, card, fonts)) return null;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
