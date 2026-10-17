import { IMAGE_ALT } from "@/og/poster";
import { renderPoster } from "@/og/render";

export const alt = IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The site-level card for the landing: the question, with no user. */
export default function Image() {
  return renderPoster(null, null);
}
