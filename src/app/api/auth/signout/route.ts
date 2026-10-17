import { ConfigError, githubOAuthApp } from "@/github/config";
import { revokeToken, safeReturnTo } from "@/github/oauth";
import { redirectResponse } from "@/github/responses";
import { clearSessionCookie, readSessionToken } from "@/github/session";

/** Browsers that omit Origin on same-origin POSTs still send this. */
function isSameSite(request: Request, origin: string): boolean {
  const claimed = request.headers.get("origin");
  if (claimed) return claimed === origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
}

/**
 * Signs out: revokes the token at GitHub (best effort, never blocks or fails
 * the sign-out) and clears the session cookie. POST only, and only from this site.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!isSameSite(request, url.origin)) {
    return new Response(null, { status: 403 });
  }
  const token = readSessionToken(request.headers);
  if (token) {
    try {
      await revokeToken(token, githubOAuthApp());
    } catch (error) {
      // Only a missing OAuth app configuration can land here; sign-out still succeeds.
      if (!(error instanceof ConfigError)) throw error;
    }
  }
  return redirectResponse(
    safeReturnTo(url.searchParams.get("returnTo")),
    [clearSessionCookie()],
    303,
  );
}
