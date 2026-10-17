type Env = Record<string, string | undefined>;

/**
 * The playback lab is for previews and local work only. This fails closed:
 * on Vercel only "preview" and "development" pass; outside Vercel, a
 * production build needs an explicit ALLOW_LAB=1 (used by the e2e server).
 */
export function isLabEnabled(env: Env): boolean {
  const vercel = env.VERCEL_ENV;
  if (vercel !== undefined && vercel !== "") {
    return vercel === "preview" || vercel === "development";
  }
  return env.NODE_ENV !== "production" || env.ALLOW_LAB === "1";
}
