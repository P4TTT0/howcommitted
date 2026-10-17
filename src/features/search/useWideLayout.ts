import { useSyncExternalStore } from "react";

/** Keep in sync with `@custom-variant wide` in globals.css. */
const WIDE_QUERY = "(min-width: 1024px) and (orientation: landscape)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on landscape screens wide enough for the two-column landing. */
export function useWideLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}
