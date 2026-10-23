import type { Metadata } from "next";
import { imagePath } from "./login";
import {
  cachedDescription,
  genericDescription,
  IMAGE_ALT,
  IMAGE_SIZE,
  type PosterModel,
  pageTitle,
} from "./poster";

export const SITE_NAME = "How Committed";

/**
 * Per-user page metadata. `model` is the cached poster data, or null when the
 * profile is not cached: then the description carries no numbers. The image is
 * served by /api/og/{login} (a catch-all segment cannot host an
 * opengraph-image file), which is cache-only as well.
 */
export function userMetadata(
  login: string,
  model: PosterModel | null,
): Metadata {
  const title = pageTitle(model?.login ?? login);
  const description = model
    ? cachedDescription(model)
    : genericDescription(login);
  const images = [{ url: imagePath(login), ...IMAGE_SIZE, alt: IMAGE_ALT }];
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
