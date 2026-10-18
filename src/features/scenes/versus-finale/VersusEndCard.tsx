"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { swatchClass } from "@/features/versus/palette";
import { FIXED_LINE } from "@/og/poster";
import { actionClass } from "@/ui/classes";
import type { VersusSummary } from "./summary";

type Props = {
  summaries: readonly VersusSummary[];
  onReplay: () => void;
};

/**
 * The versus poster: one column per developer in the order they were added,
 * each with their calendar total and years. Same size, same weight: nothing
 * here orders or compares them.
 */
export function VersusEndCard({ summaries, onReplay }: Props) {
  const replayRef = useRef<HTMLButtonElement>(null);
  // The race just ended: move focus to the obvious next action.
  useEffect(() => replayRef.current?.focus(), []);

  return (
    <section
      aria-label="Versus summary"
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4"
    >
      <h2 className="font-display text-[clamp(40px,9vw,96px)] font-black uppercase leading-[0.9]">
        Versus
      </h2>
      <ul className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        {summaries.map((summary, index) => (
          <li
            key={summary.login.toLowerCase()}
            className="flex flex-col gap-2 border-2 border-ink p-3"
          >
            <span className="flex min-w-0 items-center gap-2 font-mono text-sm font-bold">
              <span
                aria-hidden="true"
                className={`size-4 shrink-0 ${swatchClass(index)}`}
              />
              <span className="truncate">@{summary.login}</span>
            </span>
            <span
              aria-hidden="true"
              className="font-display text-[clamp(40px,10vw,88px)] font-extrabold leading-[0.85] tabular-nums"
            >
              {summary.total.toLocaleString("en-US")}
            </span>
            <span className="font-mono text-xs">
              {summary.totalText}, {summary.span}
            </span>
          </li>
        ))}
      </ul>
      <p className="font-mono text-xs">{FIXED_LINE}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={replayRef}
          type="button"
          onClick={onReplay}
          className={`${actionClass} bg-ink text-paper`}
        >
          Replay
        </button>
        <Link href="/" className={actionClass}>
          Search again
        </Link>
      </div>
    </section>
  );
}
