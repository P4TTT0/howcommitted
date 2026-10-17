import { parseLoginSegment } from "@/features/experience/parseSoloLogin";

/**
 * The `vs` query param ("Challenge someone" on the final poster): the login
 * to prefill as player 1. Null when versus is off, or the value is missing,
 * repeated or not a valid, non-reserved login.
 */
export function parseVsParam(
  search: string,
  versusEnabled: boolean,
): string | null {
  if (!versusEnabled) return null;
  const values = new URLSearchParams(search).getAll("vs");
  if (values.length !== 1) return null;
  return parseLoginSegment(values[0] ?? "");
}
