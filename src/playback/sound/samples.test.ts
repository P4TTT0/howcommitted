import { describe, expect, it } from "vitest";
import { pickFormat } from "./samples";

describe("pickFormat", () => {
  it("prefers ogg when the browser can play it", () => {
    expect(pickFormat(() => "probably")).toBe("ogg");
    expect(pickFormat(() => "maybe")).toBe("ogg");
  });

  it("falls back to mp3 when ogg cannot be played", () => {
    expect(pickFormat(() => "")).toBe("mp3");
  });
});
