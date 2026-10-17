import type { ReactNode } from "react";

/** Shared look of the screens around the scene: a color block with the login. */

export const actionClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-ink px-4 font-mono text-xs uppercase focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Fluid size for the login: long names wrap, so they get a smaller size. */
function loginSize(login: string): string {
  const characters = login.length + 1; // the "@" counts
  let vw = 6;
  if (characters <= 6) vw = 22;
  else if (characters <= 9) vw = 17;
  else if (characters <= 12) vw = 12;
  else if (characters <= 18) vw = 8;
  return `min(${vw}vw, 24dvh)`;
}

export function Poster({
  login,
  tone = "block",
  heading = true,
  wipe = false,
  children,
}: {
  login: string;
  /** False when the page already has an h1 (the scene overlay). */
  heading?: boolean;
  /** The block wipes in from the left, like a year in the scene. */
  wipe?: boolean;
  /** "block" is the first year color; "ink" is calmer, for errors and empty. */
  tone?: "block" | "ink";
  children: ReactNode;
}) {
  const Title = heading ? "h1" : "p";
  const colors =
    tone === "block" ? "bg-block-ultramarine text-paper" : "bg-ink text-paper";
  return (
    <div className="absolute inset-0 flex flex-col bg-paper text-ink">
      <header
        className={`flex h-[42dvh] shrink-0 items-end p-4 ${colors} ${wipe ? "loading-block" : ""}`}
      >
        <Title
          className="font-display font-black uppercase leading-[0.8] [overflow-wrap:anywhere]"
          style={{ fontSize: loginSize(login) }}
        >
          @{login}
        </Title>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col gap-4 p-4 pb-14">
        {children}
      </div>
    </div>
  );
}

/**
 * Loading is part of the experience: the first color block lands and the
 * baseline of the line starts to draw. Progress is unknown, so the baseline
 * approaches but never reaches the end.
 */
export function LoadingMoment({
  login,
  label,
  heading = true,
}: {
  login: string;
  label: string;
  heading?: boolean;
}) {
  return (
    <Poster login={login} heading={heading} wipe>
      <p role="status" className="font-mono text-xs">
        {label}
      </p>
      <div className="loading-baseline mt-auto h-3 w-full bg-ink" />
    </Poster>
  );
}
