import { describe, expect, it, vi } from "vitest";
import { type Pool, pickFormat, stopPools } from "./samples";

describe("pickFormat", () => {
  it("prefers ogg when the browser can play it", () => {
    expect(pickFormat(() => "probably")).toBe("ogg");
    expect(pickFormat(() => "maybe")).toBe("ogg");
  });

  it("falls back to mp3 when ogg cannot be played", () => {
    expect(pickFormat(() => "")).toBe("mp3");
  });
});

describe("stopPools", () => {
  it("stops every voice and empties the pools", () => {
    const a = { stop: vi.fn() };
    const b = { stop: vi.fn() };
    const pools = { x: [a], y: [b] } as unknown as Record<string, Pool>;
    stopPools(pools, 1.5);
    expect(a.stop).toHaveBeenCalledWith(1.5);
    expect(b.stop).toHaveBeenCalledWith(1.5);
    expect(pools.x).toHaveLength(0);
    expect(pools.y).toHaveLength(0);
  });
});
