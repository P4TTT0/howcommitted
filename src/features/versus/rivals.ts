import { MAX_DEVELOPERS } from "./parseVersusLogins";

export type AddRivalResult =
  | { kind: "added"; rivals: string[] }
  | { kind: "duplicate" }
  | { kind: "full" };

/**
 * Adds a rival to the developers already chosen. `main` is the developer in
 * the question (P1); the total never exceeds MAX_DEVELOPERS. Logins are
 * compared case-insensitively and keep the spelling they were found with.
 */
export function addRival(
  main: string,
  rivals: readonly string[],
  login: string,
): AddRivalResult {
  const key = login.toLowerCase();
  if (
    main.toLowerCase() === key ||
    rivals.some((rival) => rival.toLowerCase() === key)
  ) {
    return { kind: "duplicate" };
  }
  if (1 + rivals.length >= MAX_DEVELOPERS) return { kind: "full" };
  return { kind: "added", rivals: [...rivals, login] };
}

export function removeRival(
  rivals: readonly string[],
  login: string,
): string[] {
  return rivals.filter((rival) => rival.toLowerCase() !== login.toLowerCase());
}

/** The rivals that still make sense next to `main` (drops a repeat of it). */
export function rivalsFor(main: string, rivals: readonly string[]): string[] {
  return rivals.filter((rival) => rival.toLowerCase() !== main.toLowerCase());
}
