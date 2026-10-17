import "server-only";
import type { GithubError } from "./graphql";

/** A GitHub-side failure, as returned to routes (never thrown). */
export type Failure =
  | { status: "not_found" }
  | { status: "rate_limited"; resetAt: string | null }
  | { status: "timeout" }
  | { status: "upstream_error"; message: string };

export function toFailure(error: GithubError): Failure {
  switch (error.kind) {
    case "not_found":
      return { status: "not_found" };
    case "rate_limited":
      return { status: "rate_limited", resetAt: error.resetAt };
    case "timeout":
      return { status: "timeout" };
    case "unauthorized":
      // Reaches a route only for the server token; a visitor's rejected token is handled in profile.ts.
      return {
        status: "upstream_error",
        message: "GitHub rejected the access token",
      };
    case "upstream":
      return { status: "upstream_error", message: error.message };
  }
}
