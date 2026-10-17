import "server-only";
import { Redis } from "@upstash/redis";

/** Thrown when a route needs an environment variable that is not set. */
export class ConfigError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable ${name}. See .env.example.`);
    this.name = "ConfigError";
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(name);
  return value;
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
