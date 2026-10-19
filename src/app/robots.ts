import type { MetadataRoute } from "next";
import { resolveSiteOrigin } from "@/og/origin";

/**
 * Production lets crawlers in, except the lab and the API. Previews and local
 * builds ask every crawler to stay out, so only the real site is indexed.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const origin = resolveSiteOrigin(process.env);
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/lab", "/api/"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
