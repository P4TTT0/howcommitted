import { isValidLogin } from "@/domain/login";
import { cookieSecret } from "@/github/config";
import { getProfile } from "@/github/profile";
import { historyResponse, invalidLogin, serverError } from "@/github/responses";
import { getServices } from "@/github/services";
import { resolveVisitor } from "@/github/visitor";

/** A cold 16-year profile takes a few seconds of fan-out; leave headroom for coalescing waits. */
export const maxDuration = 60;

type Context = { params: Promise<{ login: string }> };

/** Full profile history. Cached profiles are free; cold ones count toward the anonymous quota. */
export async function GET(request: Request, { params }: Context) {
  const { login } = await params;
  if (!isValidLogin(login)) return invalidLogin();

  try {
    const { deps } = getServices();
    const { visitor, setCookie } = resolveVisitor(
      request.headers,
      cookieSecret(),
    );
    const result = await getProfile(login, visitor, deps);
    return historyResponse(result, setCookie);
  } catch (cause) {
    return serverError(cause);
  }
}
