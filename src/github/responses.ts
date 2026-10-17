import "server-only";
import { buildHistory } from "@/domain/history";
import { ConfigError } from "./config";
import type { PreviewResult, ProfileResult } from "./profile";

const NO_STORE = { "cache-control": "no-store" };

function error(
  status: number,
  code: string,
  message: string,
  extra: { retryAfterSeconds?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(extra.headers);
  headers.set("cache-control", "no-store");
  if (extra.retryAfterSeconds) {
    headers.set("retry-after", String(extra.retryAfterSeconds));
  }
  return Response.json({ error: { code, message } }, { status, headers });
}

export const invalidLogin = () =>
  error(400, "invalid_login", "That is not a valid GitHub username.");

export const previewRateLimited = () =>
  error(429, "rate_limited", "Slow down a little and try again.", {
    retryAfterSeconds: 30,
  });

/** Logs the real cause server-side; the client only sees a generic message. */
export function serverError(cause: unknown): Response {
  console.error(cause);
  if (cause instanceof ConfigError) {
    return error(500, "server_misconfigured", "The server is not configured.");
  }
  return error(500, "internal_error", "Something went wrong on our side.");
}

type Unsuccessful =
  | Exclude<PreviewResult, { status: "ok" }>
  | Exclude<ProfileResult, { status: "ok" }>;

const DEGRADED_MESSAGES = {
  busy: "Still working on this one. Try again in a moment.",
  circuit_open: "GitHub needs a breather. Cached profiles still work.",
  store_down: "Our cache is unavailable right now. Try again in a minute.",
} as const;

function secondsUntil(resetAt: string | null): number {
  if (!resetAt) return 60;
  const seconds = Math.ceil((Date.parse(resetAt) - Date.now()) / 1000);
  return Math.min(Math.max(seconds, 1), 3600);
}

function failure(result: Unsuccessful, headers?: HeadersInit): Response {
  switch (result.status) {
    case "not_found":
      return error(404, "not_found", "No GitHub user with that name.", {
        headers,
      });
    case "login_required":
      return error(
        401,
        "login_required",
        "Free runs used. Sign in with GitHub to keep going.",
        { headers },
      );
    case "degraded":
      return error(503, "degraded", DEGRADED_MESSAGES[result.reason], {
        retryAfterSeconds: result.reason === "busy" ? 5 : 60,
        headers,
      });
    case "rate_limited":
      return error(429, "rate_limited", "GitHub needs a breather.", {
        retryAfterSeconds: secondsUntil(result.resetAt),
        headers,
      });
    case "timeout":
      return error(504, "timeout", "GitHub took too long to answer.", {
        headers,
      });
    case "upstream_error":
      return error(502, "upstream_error", "GitHub returned an error.", {
        headers,
      });
  }
}

export function previewResponse(result: PreviewResult): Response {
  if (result.status !== "ok") return failure(result);
  const { login, name, avatarUrl, createdAt, contributionYears } = result.user;
  return Response.json(
    { user: { login, name, avatarUrl, createdAt, contributionYears } },
    { headers: NO_STORE },
  );
}

export function historyResponse(
  result: ProfileResult,
  setCookie: string | null,
): Response {
  const headers = new Headers(NO_STORE);
  if (setCookie) headers.append("set-cookie", setCookie);
  if (result.status !== "ok") return failure(result, headers);
  return Response.json(
    {
      source: result.source,
      reposTruncated: result.reposTruncated,
      history: buildHistory(result.profile),
    },
    { headers },
  );
}
