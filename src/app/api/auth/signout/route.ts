import { safeReturnTo } from "@/github/oauth";
import { redirectResponse } from "@/github/responses";
import { clearSessionCookie } from "@/github/session";

/** Signs out by clearing the session cookie. POST only, and only from this site. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return new Response(null, { status: 403 });
  }
  return redirectResponse(
    safeReturnTo(url.searchParams.get("returnTo")),
    [clearSessionCookie()],
    303,
  );
}
