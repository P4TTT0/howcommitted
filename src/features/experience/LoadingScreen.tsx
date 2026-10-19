"use client";

import { useEffect, useState } from "react";
import { actionClass, labelClass } from "@/ui/classes";
import {
  cellFill,
  easedPercent,
  PHRASES,
  PROGRESS_CELLS,
  phraseIndex,
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
  login,
  onCancel,
}: {
  login: string;
  onCancel: () => void;
}) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(
      () => setPercent(easedPercent(Date.now() - startedAt)),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const step = phraseIndex(percent);
  const done = PHRASES.slice(Math.max(0, step - 2), step);
  const { className, fontSize } = loginTypography(login);

  return (
    <div
      data-loading-frame
      className="absolute inset-0 flex flex-col bg-paper text-ink"
    >
      <header className="flex shrink-0 flex-col gap-4 bg-block-ultramarine p-4 text-paper md:px-8 md:pt-10 md:pb-7 lg:px-16">
        <div
          className={`flex items-center justify-between gap-3 ${labelClass}`}
        >
          <p>
            <span className="md:hidden">Reading the history</span>
            <span className="hidden md:inline">
              Reading the contribution history
            </span>
          </p>
          <button
            type="button"
            onClick={onCancel}
            className={`${actionClass} border-paper hover:border-paper hover:bg-paper hover:text-ink`}
          >
            Cancel
          </button>
        </div>
        <h1
          tabIndex={-1}
          className={`${className} outline-none`}
          style={{ fontSize }}
        >
          @{login}
        </h1>
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
              {PHRASES[step]}
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
