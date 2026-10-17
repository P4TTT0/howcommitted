import { describe, expect, it } from "vitest";
import { open, seal } from "./seal";

const SECRET = "s".repeat(40);
const NOW = new Date("2026-10-17T12:00:00Z");
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe("seal and open", () => {
  it("round-trips data", () => {
    const sealed = seal("p", { token: "gho_abc" }, SECRET, 60, NOW);
    expect(open("p", sealed, SECRET, NOW)).toEqual({ token: "gho_abc" });
  });

  it("never exposes the plaintext and uses a fresh IV each time", () => {
    const a = seal("p", { token: "gho_plainsecret" }, SECRET, 60, NOW);
    const b = seal("p", { token: "gho_plainsecret" }, SECRET, 60, NOW);
    expect(a).not.toContain("gho_plainsecret");
    expect(
      Buffer.from(a.slice(3), "base64url").toString("latin1"),
    ).not.toContain("gho_plainsecret");
    expect(a).not.toBe(b);
  });

  it("rejects an expired value", () => {
    const sealed = seal("p", "x", SECRET, 60, NOW);
    expect(open("p", sealed, SECRET, later(59))).toBe("x");
    expect(open("p", sealed, SECRET, later(60))).toBeNull();
    expect(open("p", sealed, SECRET, later(3600))).toBeNull();
  });

  it("rejects a value opened with another secret or purpose", () => {
    const sealed = seal("session", "x", SECRET, 60, NOW);
    expect(open("session", sealed, "t".repeat(40), NOW)).toBeNull();
    expect(open("oauth", sealed, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered value at any position", () => {
    const sealed = seal("p", { token: "gho_abc" }, SECRET, 60, NOW);
    const raw = Buffer.from(sealed.slice(3), "base64url");
    for (const index of [0, 11, 12, raw.length - 17, raw.length - 1]) {
      const copy = Buffer.from(raw);
      copy[index] = (copy[index] ?? 0) ^ 0x01;
      expect(
        open("p", `v1.${copy.toString("base64url")}`, SECRET, NOW),
      ).toBeNull();
    }
  });

  it("rejects malformed, truncated, unversioned and oversized values", () => {
    const sealed = seal("p", "x", SECRET, 60, NOW);
    expect(open("p", undefined, SECRET, NOW)).toBeNull();
    expect(open("p", "", SECRET, NOW)).toBeNull();
    expect(open("p", "garbage", SECRET, NOW)).toBeNull();
    expect(open("p", "v1.", SECRET, NOW)).toBeNull();
    expect(open("p", sealed.slice(0, -4), SECRET, NOW)).toBeNull();
    expect(open("p", sealed.replace("v1.", "v2."), SECRET, NOW)).toBeNull();
    expect(open("p", `v1.${"A".repeat(5000)}`, SECRET, NOW)).toBeNull();
  });
});
