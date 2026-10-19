import { describe, expect, it, vi } from "vitest";
import {
  challengeHref,
  FIXED_LINE,
  posterTopLine,
  privateNote,
  privateTag,
  shareMessage,
  shareProfile,
  yearBars,
} from "./poster";

const data = { title: "t", text: "x", url: "https://e.test/ada" };

describe("poster copy", () => {
  it("states the login and the span, never a commit count", () => {
    expect(posterTopLine("ada", 2022, 2026)).toBe("@ada · 2022 — 2026");
    expect(posterTopLine("ada", 2024, 2024)).toBe("@ada · 2024");
  });

  it("tags the private share only when there is one", () => {
    expect(privateTag(456)).toBe("Includes 456 private");
    expect(privateTag(0)).toBeNull();
  });

  it("shows the card private note only when above zero", () => {
    expect(privateNote(0)).toBeNull();
    expect(privateNote(1912)).toBe("Includes 1,912 private contributions.");
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

  it("keeps the fixed line verbatim", () => {
    expect(FIXED_LINE).toBe(
      "Contributions are not productivity. This is rhythm, not value.",
    );
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
