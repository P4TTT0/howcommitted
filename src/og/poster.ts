import type { UserProfile, YearSummary } from "@/domain/types";
import { blocks } from "@/ui/tokens";

export const IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const IMAGE_ALT =
  "A How Committed poster: how committed is this GitHub user? Contributions are not productivity. This is rhythm, not value.";

/** The line every share card carries (docs/product.md, Core principle). */
export const FIXED_LINE =
  "Contributions are not productivity. This is rhythm, not value.";

/** Year block colors in the same rotation order as the experience. */
const BLOCK_ROTATION = [
  blocks.ultramarine,
  blocks.safety,
  blocks.forest,
  blocks.signal,
  blocks.violet,
  blocks.pink,
] as const;

/** A year with contributions never disappears: it keeps at least this share of the tallest block. */
const MIN_BAR_RATIO = 0.03;

export type PosterBar = {
  year: number;
  contributions: number;
  /** 0..1, relative to the tallest year. */
  ratio: number;
  color: string;
};

export type PosterModel = {
  login: string;
  /** Sum of the yearly calendar totals. */
  totalContributions: number;
  /** Private contributions the user chose to share, as a count only. */
  privateContributions: number;
  /** Oldest first. */
  bars: PosterBar[];
  firstYear: number;
  lastYear: number;
};

/** Everything the poster needs from a cached profile. Null when there is no year to draw. */
export function buildPosterModel(
  user: Pick<UserProfile, "login">,
  years: readonly YearSummary[],
): PosterModel | null {
  const ordered = [...years].sort((a, b) => a.year - b.year);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return null;

  const tallest = Math.max(...ordered.map((y) => y.totalContributions));
  return {
    login: user.login,
    totalContributions: ordered.reduce(
      (sum, y) => sum + y.totalContributions,
      0,
    ),
    privateContributions: ordered.reduce(
      (sum, y) => sum + y.totals.privateContributions,
      0,
    ),
    bars: ordered.map((y, index) => ({
      year: y.year,
      contributions: y.totalContributions,
      ratio:
        tallest === 0
          ? MIN_BAR_RATIO
          : Math.max(y.totalContributions / tallest, MIN_BAR_RATIO),
      color: BLOCK_ROTATION[index % BLOCK_ROTATION.length] as string,
    })),
    firstYear: first.year,
    lastYear: last.year,
  };
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** "Includes N private contributions." only when there are any. */
export function privateLine(privateContributions: number): string | null {
  if (privateContributions <= 0) return null;
  const noun = privateContributions === 1 ? "contribution" : "contributions";
  return `Includes ${formatCount(privateContributions)} private ${noun}.`;
}

export function yearRange(model: PosterModel): string {
  return model.firstYear === model.lastYear
    ? `${model.firstYear}`
    : `${model.firstYear} to ${model.lastYear}`;
}

export function contributionsLabel(total: number): string {
  return `${total === 1 ? "contribution" : "contributions"}`;
}

export function pageTitle(login: string): string {
  return `@${login} | How Committed`;
}

/** Description for a login whose profile is not cached (or unknown): no numbers. */
export function genericDescription(login: string): string {
  return `How committed is @${login}? Watch their GitHub contribution history play out.`;
}

/** Description with calendar totals. Counts contributions, never commits. */
export function cachedDescription(model: PosterModel): string {
  const parts = [
    `${formatCount(model.totalContributions)} ${contributionsLabel(model.totalContributions)} on GitHub, ${yearRange(model)}.`,
    privateLine(model.privateContributions),
    FIXED_LINE,
  ];
  return parts.filter((part) => part !== null).join(" ");
}

/**
 * Font size (px) for the login line of the generic poster, so a 39-character
 * login still fits one line. Big Shoulders is condensed: about half an em per
 * character is a safe average for the mixed-case line "is @login?".
 */
export function loginFontSize(
  login: string,
  availableWidth: number,
  maxSize: number,
): number {
  const characters = login.length + 4;
  return Math.min(maxSize, Math.floor(availableWidth / (characters * 0.5)));
}
