import type { MetadataRoute } from "next";
import { resolveSiteOrigin } from "@/og/origin";

/**
 * Only the landing. Profile and versus pages are endless and kept out of the
 * index on purpose (see the noindex in `[...users]/page.tsx`).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${resolveSiteOrigin(process.env)}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
