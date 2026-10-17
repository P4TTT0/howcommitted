import { authCookieSecret, githubOAuthApp } from "@/github/config";
import { startSignIn } from "@/github/oauth";
import { redirectResponse, serverError } from "@/github/responses";

/** Starts "Sign in with GitHub": binds a fresh `state` to this browser, then sends the visitor to GitHub. */
export async function GET(request: Request) {
  try {
    const { clientId } = githubOAuthApp();
    const returnTo = new URL(request.url).searchParams.get("returnTo");
    const { location, setCookie } = startSignIn(
      returnTo,
      clientId,
      authCookieSecret(),
    );
    return redirectResponse(location, [setCookie]);
  } catch (cause) {
    return serverError(cause);
  }
}
