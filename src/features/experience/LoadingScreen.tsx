"use client";

import { useEffect, useState } from "react";
import { FitText } from "@/features/scenes/finale/FitText";
import { actionClass, labelClass } from "@/ui/classes";
import {
  cellFill,
  easedPercent,
  PROGRESS_CELLS,
  phraseIndex,
  phrasesFor,
  playerBlockClass,
} from "./loadingProgress";
import { loginTypography } from "./Poster";

/** The block palette, in scene order. Full class names so Tailwind keeps them. */
const CELL_COLORS = [
  "bg-block-ultramarine",
  "bg-block-safety",
  "bg-block-forest",
  "bg-block-signal",
  "bg-block-violet",
  "bg-block-pink",
] as const;

const TICK_MS = 150;

/**
 * The wait for a contribution history. Progress is an eased estimate (see
 * loadingProgress.ts); the screen unmounts when the real data arrives, so the
 * estimate never claims 100%. Nothing here is animated by CSS: the numbers and
 * fills change in steps, so reduced motion needs no special case.
 */
export function LoadingScreen({
  logins,
  status,
  onCancel,
}: {
  logins: string[];
  /** Real progress copy that replaces the header label, such as "2 of 3". */
  status?: string;
  onCancel: () => void;
}) {
  const versus = logins.length > 1;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(
      () => setPercent(easedPercent(Date.now() - startedAt)),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const phrases = phrasesFor(logins.length);
  const step = phraseIndex(percent, phrases.length);
  const done = phrases.slice(Math.max(0, step - 2), step);

  return (
    <div
      data-loading-frame
      className="absolute inset-0 flex flex-col bg-paper text-ink"
    >
      <header
        className={`flex shrink-0 flex-col gap-4 p-4 text-paper md:px-8 md:pt-10 md:pb-7 lg:px-16 ${versus ? "bg-ink" : "bg-block-ultramarine"}`}
      >
        <div
          className={`flex items-center justify-between gap-3 ${labelClass}`}
        >
          <p>
            {status ?? (
              <>
                <span className="md:hidden">Reading the history</span>
                <span className="hidden md:inline">
                  Reading the contribution history
                </span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onCancel}
            className={`${actionClass} border-paper hover:border-paper hover:bg-paper hover:text-ink`}
          >
            Cancel
          </button>
        </div>
        {versus ? (
          <Lineup logins={logins} />
        ) : (
          <SoloLogin login={logins[0] ?? ""} />
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:items-end md:gap-8 md:px-8 md:pt-10 md:pb-12 lg:gap-14 lg:px-16">
        <div
          aria-hidden="true"
          className="flex items-end justify-between gap-3 md:flex-col md:items-start md:justify-end md:gap-1"
        >
          <p className={`${labelClass} order-2 pb-1 md:order-1 md:pb-0`}>
            Loaded
          </p>
          <p className="order-1 flex items-baseline font-display text-[min(22dvh,40vw)] font-black leading-[0.78] tabular-nums md:order-2 md:text-[min(30dvh,20vw)]">
            <span>{percent}</span>
            <span className="text-[0.4em]">%</span>
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 md:gap-7">
          <div className="flex flex-col gap-1.5 border-t-2 border-ink pt-3 md:gap-2.5 md:border-t-0 md:pt-0">
            {done.map((text, i) => (
              <p
                key={text}
                aria-hidden="true"
                className={`${labelClass} ${
                  done.length === 1
                    ? "opacity-50"
                    : i === done.length - 1
                      ? "opacity-60"
                      : "opacity-35"
                }`}
              >
                {text} — done
              </p>
            ))}
            <p
              aria-live="polite"
              className="font-display text-[clamp(1.5rem,5dvh,2.25rem)] font-black uppercase leading-[0.92] md:text-[clamp(2rem,7dvh,4rem)]"
            >
              {phrases[step]}
            </p>
          </div>

          <ol
            aria-hidden="true"
            className="flex min-h-0 flex-1 flex-col justify-between gap-1 md:grid md:flex-none md:grid-cols-11 md:gap-x-1"
          >
            {Array.from({ length: PROGRESS_CELLS }, (_, i) => {
              const fill = cellFill(percent, i);
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed cells
                  key={i}
                  className="relative block max-h-[26px] min-h-3 flex-1 overflow-hidden bg-ink/10 md:h-10 md:max-h-none md:flex-none"
                >
                  <span
                    className={`absolute inset-y-0 left-0 ${CELL_COLORS[i % CELL_COLORS.length]}`}
                    style={{ width: `${Math.round(fill * 100)}%` }}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

function SoloLogin({ login }: { login: string }) {
  const { className, fontSize } = loginTypography(login);
  return (
    <h1
      tabIndex={-1}
      className={`${className} outline-none`}
      style={{ fontSize }}
    >
      @{login}
    </h1>
  );
}

const LINEUP_TEXT = "font-display font-black uppercase leading-[1.05]";

/**
 * Every login in its own versus color, joined by "vs". Wide screens keep one
 * line and shrink it to the measured width; phones give each login its own
 * line, each shrunk to fit. FitText measures, so nothing counts characters.
 * The color blocks are inline-block: an inline box is as tall as the font's
 * ascent and descent, taller than this tight line, so it would poke out.
 */
function Lineup({ logins }: { logins: string[] }) {
  return (
    <h1 tabIndex={-1} className="outline-none">
      <span className="hidden md:block">
        <FitText className={`${LINEUP_TEXT} text-[min(7vw,16dvh)]`}>
          {logins.map((login, index) => (
            <span key={login.toLowerCase()}>
              {index > 0 && <span className="px-[0.3em]">vs</span>}
              <span className={`inline-block px-[0.15em] ${playerBlockClass(index)}`}>
                @{login}
              </span>
            </span>
          ))}
        </FitText>
      </span>
      <span className="flex flex-col gap-1 md:hidden">
        {logins.map((login, index) => (
          <span key={login.toLowerCase()} className="flex flex-col gap-1">
            {index > 0 && (
              <span className="font-mono text-xs font-bold uppercase">vs</span>
            )}
            <FitText className={`${LINEUP_TEXT} text-[min(11vw,5.5dvh)]`}>
              <span className={`inline-block px-[0.15em] ${playerBlockClass(index)}`}>
                @{login}
              </span>
            </FitText>
          </span>
        ))}
      </span>
    </h1>
  );
}
