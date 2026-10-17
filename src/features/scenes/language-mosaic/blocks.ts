import type { LanguageShare } from "@/domain/languages";
import { BLOCK_SEQUENCE } from "@/features/sequencer/model/plan";
import { quantizeUp } from "@/playback/schedule";
import { neutrals } from "@/ui/tokens";

export const BPM = 120;
/** One sixteenth note at the tempo. */
export const GRID_SECONDS = 60 / BPM / 4;
const LEAD_SECONDS = 0.4;
/** Seconds one block takes to rise. */
export const RISE_SECONDS = 0.5;
/** Time between blocks, on the grid. */
const STEP_SECONDS = GRID_SECONDS * 3;
const TAIL_SECONDS = 1.6;
const MIN_SECONDS = 4;

export type LanguageBlock = {
  name: string;
  /** Bytes of source across owned repos. */
  size: number;
  /** 0..1 of the total. Block width is this share, nothing else. */
  share: number;
  isOther: boolean;
  background: string;
  foreground: string;
  /** Seconds on the clock at which the block starts to rise (on the grid). */
  time: number;
  /** Scale degree of its tick. */
  degree: number;
};

export type LanguageBlocksPlan = { blocks: LanguageBlock[]; duration: number };

/** Palette colors by rank; "Other" is Ink so it never reads as a language. */
export function colorsForRank(rank: number, isOther: boolean) {
  if (isOther) return { background: neutrals.ink, foreground: neutrals.paper };
  return (
    BLOCK_SEQUENCE[rank % BLOCK_SEQUENCE.length] ?? {
      background: neutrals.ink,
      foreground: neutrals.paper,
    }
  );
}

export function planLanguageBlocks(
  shares: readonly LanguageShare[],
): LanguageBlocksPlan {
  const blocks = shares.map((language, index) => ({
    name: language.name,
    size: language.size,
    share: language.share,
    isOther: language.isOther,
    ...colorsForRank(index, language.isOther),
    time: quantizeUp(LEAD_SECONDS + index * STEP_SECONDS, GRID_SECONDS),
    degree: index * 2,
  }));
  const lastTime = blocks.at(-1)?.time ?? 0;
  return {
    blocks,
    duration: Math.max(MIN_SECONDS, lastTime + RISE_SECONDS + TAIL_SECONDS),
  };
}

/** "42%" or "5.2%"; below one tenth of a percent it says so instead of "0.0%". */
export function formatShare(share: number): string {
  const percent = share * 100;
  if (percent > 0 && percent < 0.1) return "<0.1%";
  return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
}

/** Decimal units, as GitHub reports language sizes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

/** Spoken and visible reading of one block. */
export function languageReading(
  block: Pick<LanguageBlock, "name" | "share" | "size">,
): string {
  return `${block.name}: ${formatShare(block.share)} of owned-repo code, ${formatBytes(block.size)}`;
}

/** 0..1 rise of a block at `seconds`: a decisive ease-out, no bounce. */
export function riseProgress(
  block: Pick<LanguageBlock, "time">,
  seconds: number,
  reducedMotion: boolean,
): number {
  if (seconds < block.time) return 0;
  if (reducedMotion) return 1;
  const linear = Math.min(1, (seconds - block.time) / RISE_SECONDS);
  return 1 - (1 - linear) ** 4;
}

/** Index of the block being shown at `seconds`; the first until one starts. */
export function activeBlockIndex(
  blocks: readonly Pick<LanguageBlock, "time">[],
  seconds: number,
): number {
  let active = 0;
  blocks.forEach((block, index) => {
    if (block.time <= seconds) active = index;
  });
  return active;
}
