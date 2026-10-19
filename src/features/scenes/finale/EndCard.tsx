"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import { actionClass } from "@/ui/classes";
import type { ShareCard } from "./cards";
import {
  challengeHref,
  FIXED_LINE,
  posterLabel,
  type ShareOutcome,
  shareMessage,
  shareProfile,
} from "./poster";
import { ShareCards } from "./ShareCards";

/** Digits of the big total shown at full size; longer ones shrink to fit. */
const FULL_SIZE_CHARACTERS = 6;

/** Kept for callers that import the fixed line from here. */
export const PRINCIPLE = FIXED_LINE;

type PosterProps = {
  login: string;
  total: number;
  firstYear: number;
  lastYear: number;
  note: string | null;
  /** The share cards this profile has data for; none hides the section. */
  cards: readonly ShareCard[];
  /** Private contributions included in `total`; the label omits them at 0. */
  privateContributions: number;
  /** Versus only exists outside production; the action is hidden otherwise. */
  versusEnabled: boolean;
  onReplay: () => void;
};

/** The final poster: one label, the big total, the fixed line, then the cards. */
export function EndCard({
  login,
  total,
  firstYear,
  lastYear,
  note,
  cards,
  privateContributions,
  versusEnabled,
  onReplay,
}: PosterProps) {
  const shareRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState("");
  // The scene just ended: move focus to the obvious next action.
  useEffect(() => shareRef.current?.focus(), []);

  const onShare = async () => {
    const url = `${window.location.origin}/${encodeURIComponent(login)}`;
    const outcome: ShareOutcome = await shareProfile(
      {
        title: `@${login} | Committed`,
        text: `How committed is @${login}?`,
        url,
      },
      {
        share:
          typeof navigator.share === "function"
            ? (data) => navigator.share(data)
            : undefined,
        writeText: navigator.clipboard
          ? (text) => navigator.clipboard.writeText(text)
          : undefined,
      },
    );
    setMessage(shareMessage(outcome));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-4 md:p-8 lg:flex-row lg:gap-12 lg:overflow-hidden">
      <div className="flex min-w-0 shrink-0 flex-col justify-center gap-4 lg:min-h-0 lg:flex-1 lg:shrink lg:overflow-y-auto">
        <p className="break-words font-mono text-xs uppercase [font-stretch:87.5%]">
          {posterLabel(login, total, firstYear, lastYear, privateContributions)}
        </p>
        <p
          aria-hidden="true"
          className="font-display text-[length:calc(min(32vw,22dvh)*var(--fit))] font-extrabold leading-[0.85]"
          style={
            {
              "--fit": Math.min(
                1,
                FULL_SIZE_CHARACTERS / formatCount(total).length,
              ),
            } as CSSProperties
          }
        >
          {formatCount(total)}
        </p>
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs">{FIXED_LINE}</p>
          {note && <p className="font-mono text-xs leading-4">{note}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={shareRef}
            type="button"
            onClick={onShare}
            className={`${actionClass} bg-ink text-paper`}
          >
            Share
          </button>
          {versusEnabled && (
            <Link href={challengeHref(login)} className={actionClass}>
              Challenge someone
            </Link>
          )}
          <button type="button" onClick={onReplay} className={actionClass}>
            Replay
          </button>
          <Link href="/" className={actionClass}>
            Search again
          </Link>
          <p role="status" className="font-mono text-xs">
            {message}
          </p>
        </div>
      </div>
      {cards.length > 0 && <ShareCards cards={cards} />}
    </div>
  );
}
