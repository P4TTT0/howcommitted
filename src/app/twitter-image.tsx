import { IMAGE_ALT } from "@/og/poster";
import { renderPoster } from "@/og/render";

export const alt = IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderPoster(null, null);
}
