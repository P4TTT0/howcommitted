import { isLabEnabled } from "@/features/experience/labGate";

type Env = Record<string, string | undefined>;

/**
 * Versus playback does not exist yet, so the "+ vs" control and the
 * multi-developer route follow the playback lab's gate: closed in
 * production, open in previews and local work (see isLabEnabled).
 */
export function isVersusEnabled(env: Env): boolean {
  return isLabEnabled(env);
}
