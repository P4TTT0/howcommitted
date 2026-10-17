/**
 * GitHub username rules: 1-39 characters, alphanumeric or single hyphens,
 * never starting or ending with a hyphen. "/" is impossible, so URL path
 * segments map unambiguously to users.
 */
const LOGIN_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidLogin(login: string): boolean {
  return LOGIN_PATTERN.test(login);
}

/**
 * Logins that collide with a route of the app. Static routes win over the
 * catch-all, so these users could never be opened at /{login}; they are
 * rejected explicitly instead of landing on an unrelated page.
 */
const RESERVED_LOGINS = new Set(["lab", "api"]);

export function isReservedLogin(login: string): boolean {
  return RESERVED_LOGINS.has(login.toLowerCase());
}
