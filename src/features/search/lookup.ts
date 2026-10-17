import { isValidLogin } from "@/domain/login";

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
  | { kind: "looking"; login: string }
  | { kind: "found"; user: PreviewUser }
  | { kind: "not_found"; login: string }
  /** GitHub (or our own limiter) asked us to slow down. */
  | { kind: "unavailable" }
  | { kind: "failed" };

export type InputCheck =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "valid"; login: string };

/** What was typed, without whitespace or a leading "@". */
export function normalizeLogin(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

export function checkInput(raw: string): InputCheck {
  const login = normalizeLogin(raw);
  if (login === "") return { kind: "empty" };
  return isValidLogin(login) ? { kind: "valid", login } : { kind: "invalid" };
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
): LookupState {
  if (status === 200) {
    const user = (body as { user?: unknown } | null)?.user;
    return isPreviewUser(user) ? { kind: "found", user } : { kind: "failed" };
  }
  if (status === 404) return { kind: "not_found", login };
  if (status === 400) return { kind: "invalid" };
  if (status === 429 || status === 503) return { kind: "unavailable" };
  return { kind: "failed" };
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
    : `Active ${span.first} to ${span.last}`;
}

/** Text for the status line; the found state shows a card instead. */
export function lookupMessage(state: LookupState): string {
  switch (state.kind) {
    case "idle":
      return "";
    case "invalid":
      return "GitHub usernames use letters, numbers and single hyphens, up to 39 characters.";
    case "looking":
      return `Looking up @${state.login}`;
    case "found":
      return `Found @${state.user.login}. ${formatActiveSpan(state.user.contributionYears)}.`;
    case "not_found":
      return `No GitHub user named @${state.login}`;
    case "unavailable":
      return "GitHub needs a breather. Try again in a minute.";
    case "failed":
      return "The lookup failed. Try again.";
  }
}

/** Whether a retry makes sense for this state. */
export function canRetry(state: LookupState): boolean {
  return state.kind === "unavailable" || state.kind === "failed";
}
