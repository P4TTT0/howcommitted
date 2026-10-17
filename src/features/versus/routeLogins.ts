import { parseSoloLogin } from "@/features/experience/parseSoloLogin";
import { parseVersusLogins } from "./parseVersusLogins";
import { isVersusEnabled } from "./versusGate";

type Env = Record<string, string | undefined>;

/**
 * The developers a catch-all path plays: one login is solo; two to five are
 * versus, and only where versus is enabled. Null means the path is a 404.
 */
export function routeLogins(
  users: readonly string[],
  env: Env,
): string[] | null {
  const solo = parseSoloLogin(users);
  if (solo !== null) return [solo];
  if (!isVersusEnabled(env)) return null;
  return parseVersusLogins(users);
}
