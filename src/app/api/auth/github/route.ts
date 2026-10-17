import { authCookieSecret, githubOAuthApp } from "@/github/config";
import { logEvent } from "@/github/log";
import { safeReturnTo, startSignIn } from "@/github/oauth";
import {
  authRateLimited,
  redirectResponse,
  serverError,
} from "@/github/responses";
import { getServices } from "@/github/services";
import { clientIp } from "@/github/visitor";

/** Starts "Sign in with GitHub": binds a fresh `state` to this browser, then sends the visitor to GitHub. */
export async function GET(request: Request) {
  try {
    const { clientId } = githubOAuthApp();
    const secret = authCookieSecret();
    const returnTo = new URL(request.url).searchParams.get("returnTo");
    try {
      if (
        !(await getServices().quota.allowAuthAttempt(clientIp(request.headers)))
      ) {
        return authRateLimited();
      }
    } catch (error) {
      // The limiter store is down: do not start sign-in, send the visitor back.
      logEvent("auth_limiter_error", { message: String(error) });
      return redirectResponse(safeReturnTo(returnTo), []);
    }
    const { location, setCookie } = startSignIn(returnTo, clientId, secret);
    return redirectResponse(location, [setCookie]);
  } catch (cause) {
    return serverError(cause);
  }
}
