import { isReservedLogin, isValidLogin } from "@/domain/login";

/**
 * Reads the catch-all route segments of /{...users}. One segment is the solo
 * experience; several are versus, which does not exist yet. Returns the
 * login, or null when the URL should be a 404: wrong segment count, bad
 * percent-encoding, not a valid GitHub login, or a login that collides with
 * an app route (see isReservedLogin).
 */
export function parseSoloLogin(users: readonly string[]): string | null {
  const [segment] = users;
  if (users.length !== 1 || segment === undefined) return null;
  let login: string;
  try {
    login = decodeURIComponent(segment);
  } catch {
    return null;
  }
  if (!isValidLogin(login) || isReservedLogin(login)) return null;
  return login;
}
