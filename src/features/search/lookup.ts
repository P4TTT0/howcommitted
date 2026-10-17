import { isReservedLogin, isValidLogin } from "@/domain/login";
import {
  isGithubBreather,
  parseRetryAfter,
  readApiError,
  waitPhrase,
} from "@/features/apiErrors";

/** Pause after the last keystroke before the lookup request goes out. */
export const LOOKUP_DEBOUNCE_MS = 350;

export type PreviewUser = {
  login: string;
  name: string | null;
  avatarUrl: string;
  createdAt: string;
  /** Years with contributions, newest first. */
  contributionYears: number[];
};

export type LookupState =
  | { kind: "idle" }
  | { kind: "invalid" }
  /** A real login that collides with an app route (see isReservedLogin). */
  | { kind: "reserved"; login: string }
  | { kind: "looking"; login: string }
  | { kind: "found"; user: PreviewUser }
  | { kind: "not_found"; login: string }
  /** Someone asked us to slow down: GitHub itself, or our own limits. */
  | {
      kind: "unavailable";
      cause: "github" | "traffic";
      retryAfterSeconds: number | null;
    }
  /** The request never reached the server. */
  | { kind: "network" }
  | { kind: "failed" };

export type InputCheck =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "reserved"; login: string }
  | { kind: "valid"; login: string };

/** What was typed, without whitespace or a leading "@". */
export function normalizeLogin(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

export function checkInput(raw: string): InputCheck {
  const login = normalizeLogin(raw);
  if (login === "") return { kind: "empty" };
  if (!isValidLogin(login)) return { kind: "invalid" };
  return isReservedLogin(login)
    ? { kind: "reserved", login }
    : { kind: "valid", login };
}

function isPreviewUser(value: unknown): value is PreviewUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.login === "string" &&
    typeof user.avatarUrl === "string" &&
    typeof user.createdAt === "string" &&
    (user.name === null || typeof user.name === "string") &&
    Array.isArray(user.contributionYears)
  );
}

/** Turns a `/api/user/{login}` response into a UI state. */
export function interpretLookup(
  login: string,
  status: number,
  body: unknown,
  retryAfter: string | null = null,
): LookupState {
  if (status === 200) {
    const user = (body as { user?: unknown } | null)?.user;
    return isPreviewUser(user) ? { kind: "found", user } : { kind: "failed" };
  }
  if (status === 404) return { kind: "not_found", login };
  if (status === 400) return { kind: "invalid" };
  if (status === 429 || status === 503) {
    const { reason } = readApiError(body);
    return {
      kind: "unavailable",
      cause: isGithubBreather(status, reason) ? "github" : "traffic",
      retryAfterSeconds: parseRetryAfter(retryAfter),
    };
  }
  return { kind: "failed" };
}

/**
 * Looks one login up. Resolves to null when the request was aborted, so a
 * stale answer can never overwrite what the user sees now.
 */
export async function lookupLogin(
  login: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<LookupState | null> {
  try {
    const response = await fetcher(`/api/user/${encodeURIComponent(login)}`, {
      signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (signal.aborted) return null;
    return interpretLookup(
      login,
      response.status,
      body,
      response.headers.get("retry-after"),
    );
  } catch {
    return signal.aborted ? null : { kind: "network" };
  }
}

/** First and last year with contributions, or null when there are none. */
export function activeSpan(
  years: readonly number[],
): { first: number; last: number } | null {
  if (years.length === 0) return null;
  return { first: Math.min(...years), last: Math.max(...years) };
}

export function formatActiveSpan(years: readonly number[]): string {
  const span = activeSpan(years);
  if (!span) return "No contribution years yet";
  return span.first === span.last
    ? `Active in ${span.first}`
    : `Active ${span.first}–${span.last}`;
}

/** Text for the status line; the found state shows a card instead. */
export function lookupMessage(
  state: Exclude<LookupState, { kind: "found" }>,
): string {
  switch (state.kind) {
    case "idle":
      return "";
    case "invalid":
      return "GitHub usernames use letters, numbers and single hyphens, up to 39 characters.";
    case "reserved":
      return `@${state.login} collides with a Committed page and cannot be opened yet.`;
    case "looking":
      return `Looking up @${state.login}`;
    case "not_found":
      return `No GitHub user named @${state.login}`;
    case "unavailable": {
      const wait = waitPhrase(state.retryAfterSeconds);
      return state.cause === "github"
        ? `GitHub needs a breather. Try again in ${wait}.`
        : `Too many requests right now. Try again in ${wait}.`;
    }
    case "network":
      return "Could not reach Committed. Check your connection.";
    case "failed":
      return "The lookup failed. Try again.";
  }
}

/** Whether a retry makes sense for this state. */
export function canRetry(state: LookupState): boolean {
  return (
    state.kind === "unavailable" ||
    state.kind === "network" ||
    state.kind === "failed"
  );
}
