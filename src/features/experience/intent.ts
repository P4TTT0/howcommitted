/**
 * One-shot start intent. Only the landing click records it, right before
 * navigating to /{login}; the experience consumes it on mount. Without it
 * (back/forward, reload, shared link) the start button is shown even if the
 * AudioContext is still running, so navigating around never spends a run.
 */

const KEY = "committed:start-intent";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function recordIntent(
  login: string,
  store: Store | null = defaultStore(),
): void {
  try {
    store?.setItem(KEY, login.toLowerCase());
  } catch {
    // Storage blocked: the experience simply shows its start button.
  }
}

/** True once for the login the landing click recorded; always clears it. */
export function consumeIntent(
  login: string,
  store: Store | null = defaultStore(),
): boolean {
  try {
    if (!store) return false;
    const recorded = store.getItem(KEY);
    store.removeItem(KEY);
    return recorded === login.toLowerCase();
  } catch {
    return false;
  }
}
