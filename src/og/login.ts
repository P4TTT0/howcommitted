import { isReservedLogin, isValidLogin } from "@/domain/login";

/**
 * The login of the /api/og/{login} segment, or null when it cannot be a user
 * (invalid, or colliding with an app route). Those get the generic site image
 * instead of an error: sharing a link must never fail or fetch because of how
 * the URL looks.
 */
export function imageLogin(segment: string): string | null {
  return isValidLogin(segment) && !isReservedLogin(segment) ? segment : null;
}

/** Where a page's share image lives. Relative: metadataBase makes it absolute. */
export function imagePath(login: string): string {
  return `/api/og/${encodeURIComponent(login)}`;
}
