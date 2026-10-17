import { describe, expect, it } from "vitest";
import {
  activeSpan,
  canRetry,
  checkInput,
  formatActiveSpan,
  interpretLookup,
  lookupMessage,
  normalizeLogin,
  type PreviewUser,
} from "./lookup";

const user: PreviewUser = {
  login: "torvalds",
  name: "Linus Torvalds",
  avatarUrl: "https://example.test/a.png",
  createdAt: "2011-09-03T15:26:22Z",
  contributionYears: [2025, 2024, 2012, 2011],
};

describe("checkInput", () => {
  it("is empty for blank input", () => {
    expect(checkInput("")).toEqual({ kind: "empty" });
    expect(checkInput("   ")).toEqual({ kind: "empty" });
    expect(checkInput("@")).toEqual({ kind: "empty" });
  });

  it("accepts valid logins, trimming spaces and a leading @", () => {
    expect(checkInput("  @torvalds ")).toEqual({
      kind: "valid",
      login: "torvalds",
    });
    expect(normalizeLogin("@ada-l")).toBe("ada-l");
  });

  it("rejects what GitHub would never allow, without a request", () => {
    for (const bad of ["-ada", "ada-", "a--b", "a/b", "a b", "x".repeat(40)]) {
      expect(checkInput(bad)).toEqual({ kind: "invalid" });
    }
  });
});

describe("interpretLookup", () => {
  it("finds a user", () => {
    expect(interpretLookup("torvalds", 200, { user })).toEqual({
      kind: "found",
      user,
    });
  });

  it("treats a malformed success body as a failure", () => {
    expect(interpretLookup("x", 200, { user: { login: 1 } }).kind).toBe(
      "failed",
    );
    expect(interpretLookup("x", 200, null).kind).toBe("failed");
  });

  it("maps statuses to states", () => {
    expect(interpretLookup("ghost", 404, null)).toEqual({
      kind: "not_found",
      login: "ghost",
    });
    expect(interpretLookup("x", 429, null).kind).toBe("unavailable");
    expect(interpretLookup("x", 503, null).kind).toBe("unavailable");
    expect(interpretLookup("x", 400, null).kind).toBe("invalid");
    expect(interpretLookup("x", 500, null).kind).toBe("failed");
    expect(interpretLookup("x", 502, null).kind).toBe("failed");
  });
});

describe("copy", () => {
  it("describes each state without judging anyone", () => {
    expect(lookupMessage({ kind: "idle" })).toBe("");
    expect(lookupMessage({ kind: "looking", login: "ada" })).toBe(
      "Looking up @ada",
    );
    expect(lookupMessage({ kind: "not_found", login: "ghost" })).toBe(
      "No GitHub user named @ghost",
    );
    expect(lookupMessage({ kind: "unavailable" })).toBe(
      "GitHub needs a breather. Try again in a minute.",
    );
    expect(lookupMessage({ kind: "found", user })).toBe(
      "Found @torvalds. Active 2011 to 2025.",
    );
  });

  it("offers a retry only when trying again can help", () => {
    expect(canRetry({ kind: "unavailable" })).toBe(true);
    expect(canRetry({ kind: "failed" })).toBe(true);
    expect(canRetry({ kind: "not_found", login: "x" })).toBe(false);
    expect(canRetry({ kind: "found", user })).toBe(false);
  });
});

describe("activeSpan", () => {
  it("spans the first and last contribution year", () => {
    expect(activeSpan([2025, 2012, 2018])).toEqual({ first: 2012, last: 2025 });
    expect(formatActiveSpan([2020])).toBe("Active in 2020");
    expect(formatActiveSpan([])).toBe("No contribution years yet");
  });
});
