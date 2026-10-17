import { describe, expect, it } from "vitest";
import {
  isGithubBreather,
  parseRetryAfter,
  readApiError,
  waitPhrase,
} from "./apiErrors";

describe("readApiError", () => {
  it("reads code and reason, ignoring anything else", () => {
    expect(
      readApiError({ error: { code: "degraded", reason: "busy", x: 1 } }),
    ).toEqual({ code: "degraded", reason: "busy" });
    expect(readApiError(null)).toEqual({});
    expect(readApiError({ error: "nope" })).toEqual({});
  });
});

describe("parseRetryAfter", () => {
  it("accepts positive seconds only", () => {
    expect(parseRetryAfter("30")).toBe(30);
    expect(parseRetryAfter("1.2")).toBe(2);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("0")).toBeNull();
    expect(parseRetryAfter("Wed, 21 Oct 2026 07:28:00 GMT")).toBeNull();
  });
});

describe("waitPhrase", () => {
  it("speaks in minutes", () => {
    expect(waitPhrase(null)).toBe("a minute");
    expect(waitPhrase(5)).toBe("a minute");
    expect(waitPhrase(60)).toBe("a minute");
    expect(waitPhrase(61)).toBe("2 minutes");
    expect(waitPhrase(600)).toBe("10 minutes");
  });
});

describe("isGithubBreather", () => {
  it("blames GitHub only when the cause is GitHub", () => {
    expect(isGithubBreather(503, "circuit_open")).toBe(true);
    expect(isGithubBreather(429, undefined)).toBe(true);
    expect(isGithubBreather(429, "ip_limit")).toBe(false);
    expect(isGithubBreather(503, "busy")).toBe(false);
    expect(isGithubBreather(503, "store_down")).toBe(false);
  });
});
