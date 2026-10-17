import { isValidLogin } from "@/domain/login";
import { cookieSecret } from "@/github/config";
import { getProfile } from "@/github/profile";
import { historyResponse, invalidLogin, serverError } from "@/github/responses";
import { getServices } from "@/github/services";
import { clearSessionCookie, readSession } from "@/github/session";
import { resolveVisitor } from "@/github/visitor";

/** A cold 16-year profile takes a few seconds of fan-out; leave headroom for coalescing waits. */
export const maxDuration = 60;

type Context = { params: Promise<{ login: string }> };

/**
 * Full profile history. Cached profiles are free; cold ones count toward the
 * anonymous quota, unless the visitor is signed in: they skip it, and pay with
 * their own GitHub token (except for their own profile, which the server token
 * fetches so owner-only data never enters the shared cache). A token GitHub
 * rejects clears the session and falls back to anonymous behavior. A session
 * without a stored login counts as anonymous.
 */
export async function GET(request: Request, { params }: Context) {
  const { login } = await params;
  if (!isValidLogin(login)) return invalidLogin();

  try {
    const { deps } = getServices();
    const { visitor, setCookie } = resolveVisitor(
      request.headers,
      cookieSecret(),
    );
    const cookies = setCookie ? [setCookie] : [];
    const session = readSession(request.headers);
    const result = await getProfile(login, visitor, deps, {
      userToken: session?.token ?? null,
      viewerLogin: session?.login ?? null,
      onTokenRejected: () => cookies.push(clearSessionCookie()),
    });
    return historyResponse(result, cookies);
  } catch (cause) {
    return serverError(cause);
  }
}
