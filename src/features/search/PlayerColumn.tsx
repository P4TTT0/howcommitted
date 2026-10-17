import type { ReactNode } from "react";

/**
 * The right column of the wide landing. It hosts the found developer today
 * and the versus rivals later. It keeps its width while empty so the question
 * does not shift when a card appears.
 */
export function PlayerColumn({ children }: { children?: ReactNode }) {
  return (
    <div className="hidden wide:flex wide:w-[clamp(220px,28vw,420px)] wide:shrink-0 wide:flex-col wide:gap-4">
      {children}
    </div>
  );
}
