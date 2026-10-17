import { isValidLogin } from "@/domain/login";
import { getPreview } from "@/github/profile";
import {
  invalidLogin,
  previewRateLimited,
  previewResponse,
  serverError,
} from "@/github/responses";
import { getServices } from "@/github/services";
import { clientIp } from "@/github/visitor";

type Context = { params: Promise<{ login: string }> };

/** Exact-login preview (avatar, name). Rate limited per IP. */
export async function GET(request: Request, { params }: Context) {
  const { login } = await params;
  if (!isValidLogin(login)) return invalidLogin();

  try {
    const { deps, quota } = getServices();
    if (!(await quota.allowPreview(clientIp(request.headers)))) {
      return previewRateLimited();
    }
    return previewResponse(await getPreview(login, deps));
  } catch (cause) {
    return serverError(cause);
  }
}
