import { useEffect, useState } from "react";
import { PLACEHOLDER_TICK_MS, placeholderFor } from "./placeholder";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The kinetic placeholder: types example usernames while `active`, and stays
 * static when inactive or when the visitor prefers reduced motion.
 */
export function useTypingPlaceholder(active: boolean): string {
  const [tick, setTick] = useState<number | null>(null);

  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setTick(null);
      return;
    }
    setTick(0);
    const timer = setInterval(
      () => setTick((current) => (current ?? 0) + 1),
      PLACEHOLDER_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [active]);

  return placeholderFor(tick);
}
