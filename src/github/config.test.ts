import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authCookieSecret,
  ConfigError,
  coldGenerationsPerDay,
  githubOAuthApp,
} from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("coldGenerationsPerDay", () => {
  it("falls back to the default when unset or blank", () => {
    vi.stubEnv("QUOTA_COLD_PER_DAY", "");
    expect(coldGenerationsPerDay(2)).toBe(2);
    vi.stubEnv("QUOTA_COLD_PER_DAY", "  ");
    expect(coldGenerationsPerDay(2)).toBe(2);
  });

  it("reads a whole number, including zero", () => {
    vi.stubEnv("QUOTA_COLD_PER_DAY", " 100 ");
    expect(coldGenerationsPerDay(2)).toBe(100);
    vi.stubEnv("QUOTA_COLD_PER_DAY", "0");
    expect(coldGenerationsPerDay(2)).toBe(0);
  });

  it("rejects anything that is not a whole number", () => {
    for (const value of ["-1", "1.5", "ten", "1e3"]) {
      vi.stubEnv("QUOTA_COLD_PER_DAY", value);
      expect(() => coldGenerationsPerDay(2)).toThrow(ConfigError);
    }
  });
});

describe("authCookieSecret", () => {
  it("requires the variable and at least 32 characters", () => {
    vi.stubEnv("AUTH_COOKIE_SECRET", "");
    expect(() => authCookieSecret()).toThrow(ConfigError);
    vi.stubEnv("AUTH_COOKIE_SECRET", "too-short");
    expect(() => authCookieSecret()).toThrow("at least 32 characters");
    vi.stubEnv("AUTH_COOKIE_SECRET", "x".repeat(32));
    expect(authCookieSecret()).toBe("x".repeat(32));
  });
});

describe("githubOAuthApp", () => {
  it("requires both the client id and the client secret", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "");
    expect(() => githubOAuthApp()).toThrow("GITHUB_OAUTH_CLIENT_SECRET");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "secret");
    expect(githubOAuthApp()).toEqual({
      clientId: "id",
      clientSecret: "secret",
    });
  });
});
