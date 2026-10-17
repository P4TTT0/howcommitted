import { useEffect, useState } from "react";
import {
  exampleFor,
  PLACEHOLDER_NAMES,
  PLACEHOLDER_TICK_MS,
  placeholderFor,
} from "./placeholder";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The kinetic placeholder (`text`) and the full name it is typing (`example`):
 * types example usernames while `active`, and stays
 * static when inactive or when the visitor prefers reduced motion.
 */
export function useTypingPlaceholder(active: boolean): {
  text: string;
  example: string;
} {
  const [tick, setTick] = useState<number | null>(null);

  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setTick(null);
      return;
    }
    // Start on the finished first name, so nothing collapses after hydration.
    setTick(PLACEHOLDER_NAMES[0].length - 1);
    const timer = setInterval(
      () => setTick((current) => (current ?? 0) + 1),
      PLACEHOLDER_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [active]);

  return { text: placeholderFor(tick), example: exampleFor(tick) };
}
