import { parseLoginSegment } from "@/features/experience/parseSoloLogin";

/** One developer is solo; versus holds up to this many in total. */
export const MAX_DEVELOPERS = 5;

/**
 * Reads the catch-all segments of /{p1}/{p2}/... as a versus. Two to five
 * segments, each a valid, non-reserved login. Repeats (case-insensitive) are
 * dropped keeping the first spelling; fewer than two distinct developers is
 * not a versus. Returns null when the URL should be a 404.
 */
export function parseVersusLogins(users: readonly string[]): string[] | null {
  if (users.length < 2 || users.length > MAX_DEVELOPERS) return null;
  const seen = new Set<string>();
  const logins: string[] = [];
  for (const segment of users) {
    const login = parseLoginSegment(segment);
    if (login === null) return null;
    const key = login.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    logins.push(login);
  }
  return logins.length >= 2 ? logins : null;
}

/** The path that plays these developers: /p1 for solo, /p1/p2/... for versus. */
export function versusPath(logins: readonly string[]): string {
  return `/${logins.map(encodeURIComponent).join("/")}`;
}
