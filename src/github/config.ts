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

export function githubToken(): string {
  return required("GITHUB_TOKEN");
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
