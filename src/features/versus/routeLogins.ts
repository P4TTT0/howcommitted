import { parseSoloLogin } from "@/features/experience/parseSoloLogin";
import { parseVersusLogins } from "./parseVersusLogins";

/**
 * The developers a catch-all path plays: one login is solo; two to five are
 * versus. Null means the path is a 404.
 */
export function routeLogins(users: readonly string[]): string[] | null {
  const solo = parseSoloLogin(users);
  if (solo !== null) return [solo];
  return parseVersusLogins(users);
}
