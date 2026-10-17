/** Short, so a transient failure heals quickly once the cause is gone. */
export const FALLBACK_CACHE_CONTROL = "public, max-age=60, s-maxage=60";

/** A 1x1 paper-colored PNG: the last resort when no renderer works at all. */
const PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+XJ/P7QAAAABJRU5ErkJggg==";

export function lastResortImage(): Response {
  return new Response(Buffer.from(PIXEL_PNG_BASE64, "base64"), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": FALLBACK_CACHE_CONTROL,
    },
  });
}

/**
 * Runs the attempts in order and returns the first response that renders.
 * Each attempt must fully produce its body (image streams fail late). If all
 * throw, the last resort answers: a share image never turns into a 500.
 */
export async function firstThatRenders(
  attempts: ReadonlyArray<() => Promise<Response>>,
  lastResort: () => Response = lastResortImage,
  onError: (error: unknown) => void = (error) =>
    console.error(
      JSON.stringify({ event: "og_render_error", message: String(error) }),
    ),
): Promise<Response> {
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      onError(error);
    }
  }
  return lastResort();
}
