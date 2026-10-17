import { describe, expect, it, vi } from "vitest";
import {
  challengeHref,
  FIXED_LINE,
  privateNote,
  shareMessage,
  shareProfile,
  summaryLine,
  yearBars,
} from "./poster";

const data = { title: "t", text: "x", url: "https://e.test/ada" };

describe("poster copy", () => {
  it("states totals as contributions with the year span", () => {
    expect(summaryLine("ada", 1234, 2019, 2024)).toBe(
      "@ada: 1,234 contributions, 2019 to 2024",
    );
    expect(summaryLine("ada", 1, 2024, 2024)).toBe(
      "@ada: 1 contribution, 2024",
    );
  });

  it("shows the private share only when above zero", () => {
    expect(privateNote(0)).toBeNull();
    expect(privateNote(1912)).toBe("Includes 1,912 private contributions.");
  });

  it("keeps the fixed line verbatim", () => {
    expect(FIXED_LINE).toBe(
      "Contributions are not productivity. This is rhythm, not value.",
    );
  });

  it("scales bars to the tallest year and keeps empty years", () => {
    const bars = yearBars(
      2022,
      2024,
      new Map([
        [2022, 50],
        [2024, 100],
      ]),
    );
    expect(bars.map((b) => b.ratio)).toEqual([0.5, 0, 1]);
  });

  it("links the challenge to the landing with the login", () => {
    expect(challengeHref("ada")).toBe("/?vs=ada");
  });
});

describe("shareProfile", () => {
  it("uses Web Share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareProfile(data, { share, writeText })).toBe("shared");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the URL when Web Share is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareProfile(data, { writeText })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it("does not copy when the user closes the share sheet", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("closed", "AbortError"));
    const writeText = vi.fn();
    expect(await shareProfile(data, { share, writeText })).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to copying when sharing fails", async () => {
    const share = vi.fn().mockRejectedValue(new Error("nope"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareProfile(data, { share, writeText })).toBe("copied");
  });

  it("reports failure when nothing works", async () => {
    expect(await shareProfile(data, {})).toBe("failed");
    expect(shareMessage("copied")).toBe("Copied");
    expect(shareMessage("shared")).toBe("");
  });
});
