import type { History } from "@/domain/history";
import {
  isGithubBreather,
  parseRetryAfter,
  readApiError,
  waitPhrase,
} from "@/features/apiErrors";

export type HistoryFailure =
  | { kind: "invalid" }
  | { kind: "not_found" }
  /** Anonymous runs for today are used up. */
  | { kind: "login_required" }
  /** GitHub itself is rate limited or the global circuit is open. */
  | { kind: "breather"; retryAfterSeconds: number | null }
  /** Our own limits or a busy server: waiting a little fixes it. */
  | { kind: "busy"; retryAfterSeconds: number | null }
  /** GitHub errored or timed out. */
  | { kind: "upstream" }
  /** The request never reached the server. */
  | { kind: "network" }
  | { kind: "server" };

export type HistoryOutcome =
  | { kind: "ok"; history: History; reposTruncated: boolean }
  | HistoryFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isDailyContributions(value: unknown): boolean {
  return (
    isRecord(value) && typeof value.date === "string" && isNumber(value.count)
  );
}

function isHistoryYear(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const { totals, dailyContributions } = value;
  return (
    isNumber(value.year) &&
    isRecord(totals) &&
    isNumber(totals.commits) &&
    isNumber(value.totalContributions) &&
    Array.isArray(dailyContributions) &&
    dailyContributions.every(isDailyContributions)
  );
}

function isYearBlock(value: unknown): boolean {
  return (
    isRecord(value) && isNumber(value.year) && isNumber(value.contributions)
  );
}

/** Checks everything the experience reads, so a bad payload never reaches it. */
function isHistory(value: unknown): value is History {
  if (!isRecord(value)) return false;
  const { user, years, yearBlocks, totals, totalContributions } = value;
  return (
    isRecord(user) &&
    typeof user.login === "string" &&
    typeof user.createdAt === "string" &&
    Array.isArray(years) &&
    years.every(isHistoryYear) &&
    Array.isArray(yearBlocks) &&
    yearBlocks.every(isYearBlock) &&
    isRecord(totals) &&
    isNumber(totals.commits) &&
    isNumber(totals.privateContributions) &&
    isNumber(totalContributions)
  );
}

/** Turns a `/api/history/{login}` response into an outcome. */
export function interpretHistory(
  status: number,
  body: unknown,
  retryAfter: string | null = null,
): HistoryOutcome {
  if (status === 200) {
    const payload = isRecord(body) ? body : null;
    if (payload && isHistory(payload.history)) {
      return {
        kind: "ok",
        history: payload.history,
        reposTruncated: payload.reposTruncated === true,
      };
    }
    return { kind: "server" };
  }
  if (status === 400) return { kind: "invalid" };
  if (status === 404) return { kind: "not_found" };
  if (status === 401) return { kind: "login_required" };
  if (status === 429 || status === 503) {
    const retryAfterSeconds = parseRetryAfter(retryAfter);
    const { reason } = readApiError(body);
    return isGithubBreather(status, reason)
      ? { kind: "breather", retryAfterSeconds }
      : { kind: "busy", retryAfterSeconds };
  }
  if (status === 502 || status === 504) return { kind: "upstream" };
  return { kind: "server" };
}

export type FailureCopy = {
  message: string;
  /** Trying again can help, so offer a retry. */
  retry: boolean;
};

export function failureCopy(
  failure: HistoryFailure,
  login: string,
): FailureCopy {
  switch (failure.kind) {
    case "not_found":
      return { message: `No GitHub user named @${login}`, retry: false };
    case "invalid":
      return { message: "That is not a valid GitHub username.", retry: false };
    case "login_required":
      return {
        message:
          "Free runs used for today. Sign in with GitHub is coming soon.",
        retry: false,
      };
    case "breather":
      return {
        message: `GitHub needs a breather. Try again in ${waitPhrase(failure.retryAfterSeconds)}.`,
        retry: true,
      };
    case "busy":
      return {
        message: `Too many requests right now. Try again in ${waitPhrase(failure.retryAfterSeconds)}.`,
        retry: true,
      };
    case "upstream":
      return {
        message: "GitHub did not answer well. Try again in a moment.",
        retry: true,
      };
    case "network":
      return {
        message: "Could not reach Committed. Check your connection.",
        retry: true,
      };
    case "server":
      return {
        message: "Something went wrong on our side. Try again.",
        retry: true,
      };
  }
}
