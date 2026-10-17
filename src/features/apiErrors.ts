/** Client-side reading of the API error bodies (`{ error: { code, message, reason } }`). */

export type ApiError = { code?: string; reason?: string };

export function readApiError(body: unknown): ApiError {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error !== "object" || error === null) return {};
  const { code, reason } = error as Record<string, unknown>;
  return {
    code: typeof code === "string" ? code : undefined,
    reason: typeof reason === "string" ? reason : undefined,
  };
}

/** Seconds from a `Retry-After` header (delta-seconds form), or null. */
export function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** "a minute" up to 60 s, then whole minutes. Unknown waits read as a minute. */
export function waitPhrase(seconds: number | null): string {
  if (seconds === null || seconds <= 60) return "a minute";
  return `${Math.ceil(seconds / 60)} minutes`;
}

/**
 * True when GitHub itself is the bottleneck: the global circuit is open, or a
 * 429 that carries no reason of ours (our own limits always name one).
 */
export function isGithubBreather(
  status: number,
  reason: string | undefined,
): boolean {
  return reason === "circuit_open" || (status === 429 && reason === undefined);
}
