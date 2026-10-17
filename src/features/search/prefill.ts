/**
 * One-shot search prefill. Cancelling an experience goes back to the landing
 * and hands over the login it was playing, so the question is not asked again
 * from scratch. The landing consumes it on mount; without it (a fresh visit)
 * the field starts empty.
 */

const KEY = "committed:search-prefill";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function recordPrefill(
  login: string,
  store: Store | null = defaultStore(),
): void {
  try {
    store?.setItem(KEY, login);
  } catch {
    // Storage blocked: the landing simply starts empty.
  }
}

/** The login recorded by the last cancel, once; always clears it. */
export function consumePrefill(
  store: Store | null = defaultStore(),
): string | null {
  try {
    if (!store) return null;
    const recorded = store.getItem(KEY);
    store.removeItem(KEY);
    return recorded || null;
  } catch {
    return null;
  }
}
