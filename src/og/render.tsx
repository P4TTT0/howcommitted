import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { blocks, neutrals } from "@/ui/tokens";
import {
  contributionsLabel,
  FIXED_LINE,
  formatCount,
  IMAGE_SIZE,
  loginFontSize,
  type PosterModel,
  privateLine,
  yearRange,
} from "./poster";

const PADDING = 56;
const DISPLAY = "Big Shoulders";
const MONO = "Martian Mono";

// Only the two chosen fonts, read once. Satori needs font files, not CSS.
const fontDir = join(process.cwd(), "src/og/fonts");
const [displayFont, monoFont] = await Promise.all([
  readFile(join(fontDir, "big-shoulders-latin-800-normal.woff")),
  readFile(join(fontDir, "martian-mono-latin-500-normal.woff")),
]);

const fonts = [
  {
    name: DISPLAY,
    data: displayFont,
    weight: 800 as const,
    style: "normal" as const,
  },
  {
    name: MONO,
    data: monoFont,
    weight: 500 as const,
    style: "normal" as const,
  },
];

/**
 * Crawlers fetch these constantly. A generic poster is short-lived because the
 * profile may be cached moments later; a poster with data lasts longer.
 */
const CACHE_CONTROL = {
  generic: "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
  cached: "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
} as const;

function Wordmark({ right }: { right?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontFamily: MONO,
        fontSize: 24,
        textTransform: "uppercase",
        letterSpacing: 2,
      }}
    >
      <span>Committed</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

/** "How committed is @login?" on Signal yellow, like the landing. */
function GenericPoster({ login }: { login: string | null }) {
  const name = `@${login ?? "username"}`;
  const width = IMAGE_SIZE.width - PADDING * 2;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: PADDING,
        background: blocks.signal,
        color: neutrals.ink,
      }}
    >
      <Wordmark right="howcommitted.com" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: DISPLAY,
          fontWeight: 800,
          lineHeight: 0.92,
        }}
      >
        <span
          style={{
            fontSize: 160,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          How committed
        </span>
        <span style={{ fontSize: loginFontSize(name, width, 160) }}>
          {`is ${name}?`}
        </span>
      </div>
      <div style={{ display: "flex", fontFamily: MONO, fontSize: 22 }}>
        {FIXED_LINE}
      </div>
    </div>
  );
}

/** Year blocks sized by calendar contributions, with the honest totals. */
function CachedPoster({ model }: { model: PosterModel }) {
  const note = privateLine(model.privateContributions);
  const barsHeight = 170;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: PADDING,
        background: neutrals.paper,
        color: neutrals.ink,
      }}
    >
      <Wordmark right={`@${model.login}`} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 176,
            lineHeight: 0.9,
          }}
        >
          {formatCount(model.totalContributions)}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 26,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginTop: 24,
          }}
        >
          {`${contributionsLabel(model.totalContributions)}, ${yearRange(model)}`}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: barsHeight,
            borderBottom: `3px solid ${neutrals.ink}`,
          }}
        >
          {model.bars.map((bar) => (
            <div
              key={bar.year}
              style={{
                flex: 1,
                marginLeft: 4,
                height: Math.round(bar.ratio * barsHeight),
                background: bar.color,
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 6 }}>
          {model.bars.map((bar) => (
            <span
              key={bar.year}
              style={{
                flex: 1,
                marginLeft: 4,
                display: "flex",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: model.bars.length > 12 ? 13 : 16,
              }}
            >
              {model.bars.length > 12 ? String(bar.year).slice(2) : bar.year}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: MONO,
          fontSize: 20,
        }}
      >
        {note ? <span>{note}</span> : null}
        <span>{FIXED_LINE}</span>
      </div>
    </div>
  );
}

/**
 * Renders the share image. `model` is null for the landing, for unknown or
 * uncached logins and for paths that are not a single user.
 */
export function renderPoster(
  login: string | null,
  model: PosterModel | null,
): ImageResponse {
  return new ImageResponse(
    model ? <CachedPoster model={model} /> : <GenericPoster login={login} />,
    {
      ...IMAGE_SIZE,
      fonts,
      headers: {
        "cache-control": model ? CACHE_CONTROL.cached : CACHE_CONTROL.generic,
      },
    },
  );
}
