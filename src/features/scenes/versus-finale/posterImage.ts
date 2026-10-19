import { FIXED_LINE, formatCount } from "@/og/poster";
import { neutrals, versus } from "@/ui/tokens";
import type { PosterModel } from "./poster";

/** A 4:5 portrait: fits a phone share sheet and every lineup of two to five. */
export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;
export const IMAGE_FILE = "committed-versus.png";

const SWATCHES = [versus.p1, versus.p2, versus.p3, versus.p4, versus.p5];
/** Ink on Mustard and Sky, Paper on the rest (see features/versus/swatchText). */
const ON_SWATCH = [
  neutrals.paper,
  neutrals.paper,
  neutrals.ink,
  neutrals.paper,
  neutrals.ink,
];

const MARGIN = 64;

type Fonts = { display: string; mono: string };

/** The families next/font generated, read from the CSS variables on <html>. */
function fontFamilies(): Fonts {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    display: read("--font-big-shoulders", "sans-serif"),
    mono: read("--font-martian-mono", "monospace"),
  };
}

/** Breaks `text` into lines no wider than `width` at the current font; long words break too. */
function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  const push = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of text.split(" ")) {
    const attempt = line ? `${line} ${word}` : word;
    if (context.measureText(attempt).width <= width) {
      line = attempt;
      continue;
    }
    push();
    // A word wider than a line (a long login) is cut by characters.
    line = "";
    for (const character of word) {
      if (line && context.measureText(line + character).width > width) push();
      line += character;
    }
  }
  push();
  return lines;
}

/** Shrinks `size` until `text` fits `width`; never below `min`. */
function fitSize(
  context: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  width: number,
  size: number,
  min: number,
): number {
  let fitted = size;
  context.font = font(fitted);
  while (fitted > min && context.measureText(text).width > width) {
    fitted -= 2;
    context.font = font(fitted);
  }
  return fitted;
}

/**
 * Draws the poster onto `context` (IMAGE_WIDTH x IMAGE_HEIGHT): the sum of
 * everyone on top, then a band per developer in the order they were added
 * (login on a Paper chip so small type never sits on a swatch, the calendar
 * total, the award titles), then the fixed line and the private note. Pure
 * drawing: the fonts must already be loaded.
 */
export function drawPoster(
  context: CanvasRenderingContext2D,
  model: PosterModel,
  fonts: Fonts,
) {
  const display = (weight: number) => (size: number) =>
    `${weight} ${size}px ${fonts.display}`;
  const mono = (weight: number) => (size: number) =>
    `${weight} ${size}px ${fonts.mono}`;
  const inner = IMAGE_WIDTH - MARGIN * 2;

  context.fillStyle = neutrals.paper;
  context.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  context.fillStyle = neutrals.ink;
  context.textBaseline = "alphabetic";

  let y = MARGIN + 36;
  context.font = display(900)(40);
  context.fillText("COMMITTED · VERSUS", MARGIN, y);
  context.font = mono(700)(22);
  context.textAlign = "right";
  context.fillText("howcommitted.com", MARGIN + inner, y);
  context.textAlign = "left";

  y += 56;
  context.font = mono(400)(24);
  context.fillText(model.together.toUpperCase(), MARGIN, y);

  const total = formatCount(model.total);
  const bigSize = fitSize(context, total, display(900), inner, 250, 120);
  context.font = display(900)(bigSize);
  y += bigSize * 0.88;
  context.fillText(total, MARGIN, y);

  y += 58;
  const sentenceSize = fitSize(
    context,
    model.sentence.toUpperCase(),
    display(800),
    inner,
    52,
    30,
  );
  context.font = display(800)(sentenceSize);
  context.fillText(model.sentence.toUpperCase(), MARGIN, y);

  // The footer: the fixed line, then the private note when there is one.
  context.font = mono(400)(22);
  const footer = [
    ...wrap(context, FIXED_LINE, inner),
    ...(model.privateNote ? wrap(context, model.privateNote, inner) : []),
  ];
  const lineHeight = 30;
  const footerTop = IMAGE_HEIGHT - MARGIN - footer.length * lineHeight + 8;

  // The bands share what is left above the footer.
  const gap = 14;
  const bandsTop = y + 44;
  const count = Math.max(1, model.people.length);
  const bandHeight = Math.min(
    180,
    (footerTop - 30 - bandsTop - gap * (count - 1)) / count,
  );

  model.people.forEach((person, row) => {
    const top = bandsTop + row * (bandHeight + gap);
    context.fillStyle = SWATCHES[person.index % SWATCHES.length] as string;
    context.fillRect(MARGIN, top, inner, bandHeight);
    const ink = ON_SWATCH[person.index % ON_SWATCH.length] as string;

    // Login on a Paper chip: small type never sits directly on a swatch.
    // A long login shrinks, then breaks onto a second line; it is never cut.
    const label = `@${person.login}`;
    const chipMax = inner * 0.6 - 28;
    const labelSize = fitSize(context, label, mono(700), chipMax, 22, 14);
    context.font = mono(700)(labelSize);
    const labelLines = wrap(context, label, chipMax);
    const chipWidth =
      Math.max(...labelLines.map((line) => context.measureText(line).width)) +
      28;
    const chipHeight = labelLines.length * (labelSize + 8) + 12;
    const chipY = top + 14;
    context.fillStyle = neutrals.paper;
    context.fillRect(MARGIN + 18, chipY, chipWidth, chipHeight);
    context.fillStyle = neutrals.ink;
    labelLines.forEach((line, at) => {
      context.fillText(
        line,
        MARGIN + 32,
        chipY + 6 + labelSize + at * (labelSize + 8),
      );
    });

    const numberText = formatCount(person.total);
    const numberRoom = Math.max(40, bandHeight - chipHeight - 40);
    const numberSize = fitSize(
      context,
      numberText,
      display(900),
      inner * 0.5 - 36,
      Math.min(numberRoom, 96),
      28,
    );
    context.fillStyle = ink;
    context.font = display(900)(numberSize);
    context.fillText(numberText, MARGIN + 18, top + bandHeight - 14);

    // Award titles on the right, in large type only; each fits its line.
    context.textAlign = "right";
    const shown = person.awards.slice(0, 3);
    shown.forEach((title, line) => {
      const size = fitSize(
        context,
        title.toUpperCase(),
        display(800),
        inner * 0.48,
        34,
        20,
      );
      context.font = display(800)(size);
      context.fillText(
        title.toUpperCase(),
        MARGIN + inner - 18,
        top + bandHeight - 16 - (shown.length - 1 - line) * 38,
      );
    });
    context.textAlign = "left";
  });

  context.fillStyle = neutrals.ink;
  context.font = mono(400)(22);
  footer.forEach((line, index) => {
    context.fillText(line, MARGIN, footerTop + 12 + index * lineHeight);
  });
}

/**
 * Renders the poster to a PNG. Font loading is best effort: if it fails the
 * fallback families draw instead. A canvas that cannot be made or encoded
 * throws, so nothing blank is ever offered for saving.
 */
export async function renderPosterImage(model: PosterModel): Promise<Blob> {
  const fonts = fontFamilies();
  try {
    await Promise.all([
      document.fonts.load(`900 100px ${fonts.display}`),
      document.fonts.load(`800 40px ${fonts.display}`),
      document.fonts.load(`400 22px ${fonts.mono}`),
      document.fonts.load(`700 22px ${fonts.mono}`),
    ]);
  } catch {
    // Drawing still works with the fallback families.
  }
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The poster canvas is not available.");
  drawPoster(context, model, fonts);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("The poster image could not be encoded.");
  return blob;
}

/** What happened: only "downloaded" and "shared" mean the image left the page. */
export type SaveOutcome = "downloaded" | "shared" | "cancelled";

/**
 * Hands a pre-rendered poster to the user. Called straight from the click, with
 * nothing awaited before it, so the browser still sees the user gesture. It
 * prefers the share sheet with the file (the way to "Save Image" on a phone)
 * when the browser can share files, and falls back to a download.
 */
export function savePosterImage(blob: Blob): Promise<SaveOutcome> {
  const file = new File([blob], IMAGE_FILE, { type: "image/png" });
  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    return navigator
      .share({ files: [file], title: "Committed versus" })
      .then<SaveOutcome>(() => "shared")
      .catch<SaveOutcome>((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return "cancelled";
        }
        return download(file);
      });
  }
  return Promise.resolve(download(file));
}

function download(file: File): SaveOutcome {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = IMAGE_FILE;
  document.body.append(link);
  link.click();
  link.remove();
  // Never revoke right after click(): the browser may not have read it yet.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
