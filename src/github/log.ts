import "server-only";

/** One structured JSON line per event, easy to filter in Vercel logs. */
export function logEvent(event: string, fields: Record<string, unknown>): void {
  console.info(JSON.stringify({ event, ...fields }));
}
