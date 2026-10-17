import { authCookieSecret, githubOAuthApp } from "@/github/config";
import { clearStateCookie, finishSignIn } from "@/github/oauth";
import {
  redirectResponse,
  serverError,
  signInExpired,
} from "@/github/responses";
import { sessionCookie } from "@/github/session";

/** GitHub sends the visitor back here with `code` and `state`. The token is stored encrypted, never shown. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const secret = authCookieSecret();
    const outcome = await finishSignIn(
      {
        code: params.get("code"),
        state: params.get("state"),
        error: params.get("error"),
      },
      request.headers,
      githubOAuthApp(),
      secret,
    );
    if (outcome.kind === "invalid_state") {
      const response = signInExpired();
      response.headers.append("set-cookie", clearStateCookie());
      return response;
    }
    const cookies = [clearStateCookie()];
    if (outcome.kind === "signed_in") {
      cookies.push(sessionCookie(outcome.token, secret));
    }
    return redirectResponse(outcome.returnTo, cookies);
  } catch (cause) {
    return serverError(cause);
  }
}
