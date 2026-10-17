/**
 * GitHub username rules: 1-39 characters, alphanumeric or single hyphens,
 * never starting or ending with a hyphen. "/" is impossible, so URL path
 * segments map unambiguously to users.
 */
const LOGIN_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidLogin(login: string): boolean {
  return LOGIN_PATTERN.test(login);
}
