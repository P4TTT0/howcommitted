import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "./config";
import {
  clearSessionCookie,
  isPlausibleToken,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookie,
} from "./session";

const SECRET = "k".repeat(40);
const NOW = new Date("2026-10-17T12:00:00Z");
const TOKEN = "gho_16C7e42F292c6912E7710c838347Ae178B4a";

const cookiePair = (setCookie: string) => setCookie.split(";")[0] as string;
const request = (cookie?: string) =>
  new Headers(cookie ? { cookie } : undefined);

afterEach(() => vi.unstubAllEnvs());

describe("sessionCookie", () => {
  it("is HttpOnly, SameSite=Lax, site-wide and expires in a week", () => {
    const header = sessionCookie(TOKEN, SECRET, NOW);
    expect(header).toContain(`${SESSION_COOKIE}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  });

  it("is Secure in production only", () => {
    expect(sessionCookie(TOKEN, SECRET, NOW)).not.toContain("Secure");
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookie(TOKEN, SECRET, NOW)).toContain("Secure");
    expect(clearSessionCookie()).toContain("Secure");
  });

  it("never carries the token in the clear", () => {
    expect(sessionCookie(TOKEN, SECRET, NOW)).not.toContain(TOKEN);
  });

  it("clears with an immediate expiry", () => {
    expect(clearSessionCookie()).toMatch(/^hc_session=; Path=\/; Max-Age=0;/);
  });
});

describe("readSessionToken", () => {
  const cookieFor = (token = TOKEN) =>
    cookiePair(sessionCookie(token, SECRET, NOW));
  const read = (cookie?: string, now = NOW) =>
    readSessionToken(request(cookie), now, () => SECRET);

  it("returns the token of a valid session", () => {
    expect(read(cookieFor())).toBe(TOKEN);
  });

  it("is anonymous without a cookie, and never reads the secret then", () => {
    const getSecret = vi.fn(() => SECRET);
    expect(readSessionToken(request(), NOW, getSecret)).toBeNull();
    expect(readSessionToken(request("other=1"), NOW, getSecret)).toBeNull();
    expect(getSecret).not.toHaveBeenCalled();
  });

  it("is anonymous for a tampered cookie", () => {
    const value = cookieFor();
    const flipped =
      value.slice(0, -2) + (value.endsWith("A") ? "B" : "A") + value.slice(-1);
    expect(read(flipped)).toBeNull();
    expect(read(`${SESSION_COOKIE}=v1.AAAA`)).toBeNull();
    expect(read(`${SESSION_COOKIE}=${TOKEN}`)).toBeNull();
  });

  it("is anonymous once the session expired, even if the browser kept the cookie", () => {
    const after = new Date(
      NOW.getTime() + (SESSION_MAX_AGE_SECONDS + 1) * 1000,
    );
    expect(read(cookieFor(), after)).toBeNull();
  });

  it("is anonymous when the cookie was sealed with another secret", () => {
    const other = cookiePair(sessionCookie(TOKEN, "z".repeat(40), NOW));
    expect(read(other)).toBeNull();
  });

  it("does not accept a sealed value that is not a plausible token", () => {
    expect(read(cookieFor("bad token\r\nx-injected: 1"))).toBeNull();
    expect(read(cookieFor("short"))).toBeNull();
  });

  it("degrades to anonymous, with a log line, when the auth secret is not configured", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const cookie = cookieFor();
    const token = readSessionToken(request(cookie), NOW, () => {
      throw new ConfigError("AUTH_COOKIE_SECRET");
    });
    expect(token).toBeNull();
    expect(String(info.mock.calls[0]?.[0])).toContain("auth_config_error");
    info.mockRestore();
  });
});

describe("isPlausibleToken", () => {
  it("accepts GitHub token shapes and rejects anything else", () => {
    expect(isPlausibleToken(TOKEN)).toBe(true);
    expect(isPlausibleToken("a".repeat(40))).toBe(true);
    expect(isPlausibleToken(`github_pat_${"A1".repeat(20)}`)).toBe(true);
    expect(isPlausibleToken("")).toBe(false);
    expect(isPlausibleToken(`${TOKEN} `)).toBe(false);
    expect(isPlausibleToken(`${TOKEN}\n`)).toBe(false);
    expect(isPlausibleToken("a".repeat(300))).toBe(false);
    expect(isPlausibleToken(42)).toBe(false);
    expect(isPlausibleToken(null)).toBe(false);
  });
});
