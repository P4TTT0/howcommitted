import "server-only";
import { Redis } from "@upstash/redis";

/** Thrown when a route needs an environment variable that is not set. */
export class ConfigError extends Error {
  constructor(name: string, problem = "is missing") {
    super(`Environment variable ${name} ${problem}. See .env.example.`);
    this.name = "ConfigError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(name);
  return value;
}

/** The visitor cookie is HMAC-signed with this; short secrets are brute-forceable. */
export const MIN_COOKIE_SECRET_LENGTH = 32;

export function cookieSecret(): string {
  const secret = required("QUOTA_COOKIE_SECRET");
  if (secret.length < MIN_COOKIE_SECRET_LENGTH) {
    throw new ConfigError(
      "QUOTA_COOKIE_SECRET",
      `must be at least ${MIN_COOKIE_SECRET_LENGTH} characters`,
    );
  }
  return secret;
}

/**
 * Encrypts the sign-in session and OAuth state cookies (AES-256-GCM key is
 * derived from it). Separate from the visitor cookie secret on purpose.
 */
export function authCookieSecret(): string {
  const secret = required("AUTH_COOKIE_SECRET");
  if (secret.length < MIN_COOKIE_SECRET_LENGTH) {
    throw new ConfigError(
      "AUTH_COOKIE_SECRET",
      `must be at least ${MIN_COOKIE_SECRET_LENGTH} characters`,
    );
  }
  return secret;
}

/** The "Sign in with GitHub" OAuth app. It requests no scopes: public data only. */
export function githubOAuthApp(): { clientId: string; clientSecret: string } {
  return {
    clientId: required("GITHUB_OAUTH_CLIENT_ID"),
    clientSecret: required("GITHUB_OAUTH_CLIENT_SECRET"),
  };
}

export function githubToken(): string {
  return required("GITHUB_TOKEN");
}

/**
 * Optional override of the anonymous daily cold runs, so previews can test
 * freely while production keeps the default. 0 turns anonymous cold runs off.
 */
export function coldGenerationsPerDay(fallback: number): number {
  const raw = process.env.QUOTA_COLD_PER_DAY?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new ConfigError("QUOTA_COLD_PER_DAY", "must be a whole number");
  }
  return Number(raw);
}

/** Optional namespace so previews never share keys with production. */
export function keyPrefix(): string {
  const prefix = process.env.CACHE_KEY_PREFIX?.trim();
  return prefix ? `${prefix}:` : "";
}

let redis: Redis | undefined;

export function getRedis(): Redis {
  redis ??= new Redis({
    url: required("UPSTASH_REDIS_REST_URL"),
    token: required("UPSTASH_REDIS_REST_TOKEN"),
  });
  return redis;
}
