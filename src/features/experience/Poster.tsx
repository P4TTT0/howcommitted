import type { ReactNode } from "react";

/**
 * Login size by character count (the "@" counts). Big Shoulders is for display
 * sizes only, so past the last step the login drops to Martian Mono.
 */
const LOGIN_SIZE_STEPS = [
  { maxCharacters: 6, vw: 22 },
  { maxCharacters: 9, vw: 17 },
  { maxCharacters: 12, vw: 12 },
] as const;

const DISPLAY_LOGIN_CLASS =
  "font-display font-black uppercase leading-[0.8] [overflow-wrap:anywhere]";
const SMALL_LOGIN_CLASS =
  "font-mono text-2xl font-bold leading-tight [overflow-wrap:anywhere]";

/** Typography for the login heading: display and fluid when short, mono when long. */
export function loginTypography(login: string): {
  className: string;
  fontSize?: string;
} {
  const characters = login.length + 1;
  const step = LOGIN_SIZE_STEPS.find((s) => characters <= s.maxCharacters);
  if (!step) return { className: SMALL_LOGIN_CLASS };
  return {
    className: DISPLAY_LOGIN_CLASS,
    fontSize: `min(${step.vw}vw, 24dvh)`,
  };
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
  const { className, fontSize } = loginTypography(login);
  return (
    <div className="absolute inset-0 flex flex-col bg-paper text-ink">
      <header
        className={`flex h-[42dvh] shrink-0 items-end p-4 ${colors} ${wipe ? "loading-block" : ""}`}
      >
        <Title
          // Focus target after each screen change; not a tab stop.
          tabIndex={heading ? -1 : undefined}
          className={`${className} outline-none`}
          style={{ fontSize }}
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
 * approaches but never reaches the end. Announcements come from the page's
 * persistent live region, not from this component.
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
      <p className="font-mono text-xs">{label}</p>
      <div className="loading-baseline mt-auto h-3 w-full bg-ink" />
    </Poster>
  );
}
