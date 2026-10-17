import type { History } from "@/domain/history";

export type HistoryFailure =
  | { kind: "invalid" }
  | { kind: "not_found" }
  /** Anonymous runs for today are used up. */
  | { kind: "login_required" }
  /** Rate limited or degraded: waiting a little fixes it. */
  | { kind: "breather" }
  /** GitHub errored or timed out. */
  | { kind: "upstream" }
  | { kind: "server" };

export type HistoryOutcome =
  | { kind: "ok"; history: History; reposTruncated: boolean }
  | HistoryFailure;

function isHistory(value: unknown): value is History {
  if (typeof value !== "object" || value === null) return false;
  const history = value as Record<string, unknown>;
  const user = history.user as Record<string, unknown> | null | undefined;
  return (
    typeof user?.login === "string" &&
    Array.isArray(history.years) &&
    Array.isArray(history.yearBlocks)
  );
}

/** Turns a `/api/history/{login}` response into an outcome. */
export function interpretHistory(
  status: number,
  body: unknown,
): HistoryOutcome {
  if (status === 200) {
    const payload = body as {
      history?: unknown;
      reposTruncated?: unknown;
    } | null;
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
  if (status === 429 || status === 503) return { kind: "breather" };
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
        message: "GitHub needs a breather. Try again in a minute.",
        retry: true,
      };
    case "upstream":
      return {
        message: "GitHub did not answer well. Try again in a moment.",
        retry: true,
      };
    case "server":
      return {
        message: "Something went wrong on our side. Try again.",
        retry: true,
      };
  }
}
