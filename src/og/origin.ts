/** The one public origin of the product; the apex domain redirects here. */
export const PRODUCTION_ORIGIN = "https://www.howcommitted.com";

type Env = Record<string, string | undefined>;

function asOrigin(host: string | undefined): string | null {
  const value = host?.trim();
  if (!value) return null;
  // Vercel exposes bare hosts ("app-git-branch.vercel.app"), without a scheme.
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}

/**
 * The origin social links must point at. Production is the canonical www
 * origin. A preview uses its own deployment URL (the branch alias first, then
 * the immutable one) so a preview link never sends crawlers to production.
 * Anywhere else (local dev, `next start`) it is localhost.
 */
export function resolveSiteOrigin(env: Env): string {
  if (env.VERCEL_ENV === "production") return PRODUCTION_ORIGIN;
  if (env.VERCEL_ENV === "preview") {
    const preview = asOrigin(env.VERCEL_BRANCH_URL) ?? asOrigin(env.VERCEL_URL);
    if (preview) return preview;
  }
  return `http://localhost:${env.PORT?.trim() || 3000}`;
}
