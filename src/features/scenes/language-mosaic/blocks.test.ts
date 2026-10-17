import { describe, expect, it } from "vitest";
import type { LanguageShare } from "@/domain/languages";
import {
  activeBlockIndex,
  formatBytes,
  formatShare,
  GRID_SECONDS,
  languageReading,
  planLanguageBlocks,
  RISE_SECONDS,
  riseProgress,
} from "./blocks";

const shares: LanguageShare[] = [
  { name: "TypeScript", size: 600_000, share: 0.6, isOther: false },
  { name: "Go", size: 300_000, share: 0.3, isOther: false },
  { name: "Other", size: 100_000, share: 0.1, isOther: true },
];

describe("planLanguageBlocks", () => {
  it("keeps order and shares, with Other in Ink", () => {
    const { blocks, duration } = planLanguageBlocks(shares);
    expect(blocks.map((b) => b.name)).toEqual(["TypeScript", "Go", "Other"]);
    expect(blocks[0]?.background).toBe("#1F3BFF");
    expect(blocks[2]?.background).toBe("#141414");
    expect(blocks[2]?.foreground).toBe("#F3F1EC");
    expect(duration).toBeGreaterThan((blocks[2]?.time ?? 0) + RISE_SECONDS);
  });

  it("schedules every block on the grid, in order", () => {
    const { blocks } = planLanguageBlocks(shares);
    for (const block of blocks) {
      const steps = block.time / GRID_SECONDS;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
    }
    const times = blocks.map((b) => b.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("formatting", () => {
  it("formats shares", () => {
    expect(formatShare(0.423)).toBe("42%");
    expect(formatShare(0.052)).toBe("5.2%");
    expect(formatShare(0.0004)).toBe("<0.1%");
  });

  it("formats bytes in decimal units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1_500)).toBe("1.5 KB");
    expect(formatBytes(2_340_000)).toBe("2.3 MB");
    expect(formatBytes(1_200_000_000)).toBe("1.2 GB");
  });

  it("reads a block with its share and bytes", () => {
    expect(languageReading({ name: "Go", share: 0.3, size: 300_000 })).toBe(
      "Go: 30% of owned-repo code, 300 KB",
    );
  });
});

describe("rise", () => {
  it("is zero before, one after, and instant under reduced motion", () => {
    const block = { time: 1 };
    expect(riseProgress(block, 0.5, false)).toBe(0);
    expect(riseProgress(block, 1 + RISE_SECONDS, false)).toBe(1);
    expect(riseProgress(block, 1.01, true)).toBe(1);
  });

  it("picks the active block", () => {
    const blocks = [{ time: 0.5 }, { time: 1 }, { time: 2 }];
    expect(activeBlockIndex(blocks, 0)).toBe(0);
    expect(activeBlockIndex(blocks, 1.5)).toBe(1);
    expect(activeBlockIndex(blocks, 9)).toBe(2);
  });
});
