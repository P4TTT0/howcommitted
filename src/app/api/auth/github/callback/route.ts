import { authCookieSecret, githubOAuthApp } from "@/github/config";
import { clearStateCookie, finishSignIn } from "@/github/oauth";
import {
  authRateLimited,
  redirectResponse,
  serverError,
  signInExpired,
} from "@/github/responses";
import { getServices } from "@/github/services";
import { sessionCookie } from "@/github/session";
import { clientIp } from "@/github/visitor";

/** GitHub sends the visitor back here with `code` and `state`. The token is stored encrypted, never shown. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const secret = authCookieSecret();
    const app = githubOAuthApp();
    // Before anything that can reach GitHub's token endpoint.
    if (
      !(await getServices().quota.allowAuthAttempt(clientIp(request.headers)))
    ) {
      return authRateLimited();
    }
    const outcome = await finishSignIn(
      {
        code: params.get("code"),
        state: params.get("state"),
        error: params.get("error"),
      },
      request.headers,
      app,
      secret,
    );
    if (outcome.kind === "invalid_state") {
      const response = signInExpired();
      response.headers.append("set-cookie", clearStateCookie());
      return response;
    }
    const cookies = [clearStateCookie()];
    if (outcome.kind === "signed_in") {
      cookies.push(
        sessionCookie({ token: outcome.token, login: outcome.login }, secret),
      );
    }
    return redirectResponse(outcome.returnTo, cookies);
  } catch (cause) {
    return serverError(cause);
  }
}
