import type { ReactNode } from "react";

/**
 * The right column of the wide landing. It hosts the found developer today
 * and the versus rivals later. It takes the space left by the question and
 * centers the card in it, so the page stays balanced; it exists while empty
 * so the question does not shift when a card appears.
 */
export function PlayerColumn({ children }: { children?: ReactNode }) {
  return (
    <div className="hidden wide:flex wide:min-w-0 wide:flex-1 wide:items-center wide:justify-center">
      <div className="wide:flex wide:w-[clamp(200px,min(24vw,40dvh),360px)] wide:flex-col wide:gap-4">
        {children}
      </div>
    </div>
  );
}
