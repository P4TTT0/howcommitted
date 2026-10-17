import "server-only";
import { authCookieSecret, ConfigError } from "./config";
import { logEvent } from "./log";
import { open, seal } from "./seal";
import { readCookie } from "./visitor";

/** The signed-in visitor's own GitHub token, sealed. Never readable by the page. */
export const SESSION_COOKIE = "hc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_PURPOSE = "session";

/** GitHub tokens are URL-safe; anything else is not a token and never reaches a header. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,255}$/;

export function isPlausibleToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** HttpOnly, SameSite=Lax, Secure in production. `maxAge` 0 clears the cookie. */
export function cookieHeader(
  name: string,
  value: string,
  options: { path: string; maxAge: number },
): string {
  const attributes = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

export function sessionCookie(
  token: string,
  secret: string,
  now: Date = new Date(),
): string {
  return cookieHeader(
    SESSION_COOKIE,
    seal(SESSION_PURPOSE, { token }, secret, SESSION_MAX_AGE_SECONDS, now),
    { path: "/", maxAge: SESSION_MAX_AGE_SECONDS },
  );
}

export function clearSessionCookie(): string {
  return cookieHeader(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * The visitor's own GitHub token, or null for anonymous visitors. A missing,
 * tampered or expired cookie is simply anonymous, and so is a deployment
 * without the auth secret (logged, never a 500 for a plain visitor). The secret
 * is only read when a session cookie is present.
 */
export function readSessionToken(
  headers: Headers,
  now: Date = new Date(),
  getSecret: () => string = authCookieSecret,
): string | null {
  const value = readCookie(headers, SESSION_COOKIE);
  if (!value) return null;
  try {
    const data = open(SESSION_PURPOSE, value, getSecret(), now);
    const token = (data as { token?: unknown } | null)?.token;
    return isPlausibleToken(token) ? token : null;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    logEvent("auth_config_error", { message: error.message });
    return null;
  }
}
