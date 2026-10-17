import { loadCachedPoster } from "@/og/load";
import { imageLogin } from "@/og/login";
import { renderPoster } from "@/og/render";

// Reads Redis per request; the response carries its own Cache-Control.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ login: string }> };

/**
 * Share image of a user. Cache only: it never reaches GitHub, never starts a
 * generation and never charges the quota, however often a crawler asks. An
 * uncached or unknown profile gets the generic poster.
 */
export async function GET(_request: Request, { params }: Context) {
  const login = imageLogin((await params).login);
  const model = login ? await loadCachedPoster(login) : null;
  return renderPoster(login, model);
}
