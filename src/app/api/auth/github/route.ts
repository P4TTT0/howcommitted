import { authCookieSecret, githubOAuthApp } from "@/github/config";
import { startSignIn } from "@/github/oauth";
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
    if (
      !(await getServices().quota.allowAuthAttempt(clientIp(request.headers)))
    ) {
      return authRateLimited();
    }
    const returnTo = new URL(request.url).searchParams.get("returnTo");
    const { location, setCookie } = startSignIn(returnTo, clientId, secret);
    return redirectResponse(location, [setCookie]);
  } catch (cause) {
    return serverError(cause);
  }
}
