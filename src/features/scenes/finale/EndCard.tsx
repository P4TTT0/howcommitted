"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { YearBlock } from "@/domain/year-summary";
import { formatCount } from "@/features/sequencer/model/format";
import { blockForYearIndex } from "@/features/sequencer/model/plan";
import { actionClass } from "@/ui/classes";
import type { ShareCard } from "./cards";
import {
  challengeHref,
  FIXED_LINE,
  privateNote,
  type ShareOutcome,
  shareMessage,
  shareProfile,
  summaryLine,
  yearBars,
} from "./poster";
import { ShareCards } from "./ShareCards";

/** Kept for callers that import the fixed line from here. */
export const PRINCIPLE = FIXED_LINE;

type PosterProps = {
  login: string;
  total: number;
  firstYear: number;
  lastYear: number;
  yearBlocks: readonly YearBlock[];
  note: string | null;
  /** The share cards that can be built from this profile; empty in the lab. */
  cards: readonly ShareCard[];
  /** Private contributions included in `total`; the line is hidden at 0. */
  privateContributions: number;
  /** Versus only exists outside production; the action is hidden otherwise. */
  versusEnabled: boolean;
  onReplay: () => void;
};

/** One block per calendar year: height = calendar contributions, color = year identity. */
function YearBars({
  firstYear,
  lastYear,
  yearBlocks,
}: Pick<PosterProps, "firstYear" | "lastYear" | "yearBlocks">) {
  const bars = yearBars(
    firstYear,
    lastYear,
    new Map(yearBlocks.map((block) => [block.year, block.contributions])),
  );
  const label = bars
    .map((bar) => `${bar.year} ${formatCount(bar.contributions)}`)
    .join(", ");

  return (
    <div className="flex min-h-16 flex-1 flex-col">
      <div
        role="img"
        aria-label={`Contributions per year: ${label}`}
        className="flex min-h-12 flex-1 items-end gap-px border-b-4 border-ink"
      >
        {bars.map((bar, index) => (
          <div
            key={bar.year}
            className="min-w-px flex-1"
            style={{
              height: `${Math.max(bar.ratio * 100, 2)}%`,
              backgroundColor: blockForYearIndex(index).background,
            }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-1 flex shrink-0 justify-between font-mono text-xs"
      >
        <span>{firstYear}</span>
        <span>{lastYear}</span>
      </div>
    </div>
  );
}

/** The final poster: big total, year blocks, the fixed line, then what to do next. */
export function EndCard({
  login,
  total,
  firstYear,
  lastYear,
  yearBlocks,
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

  const privateText = privateNote(privateContributions);
  return (
    <div className="flex h-full min-h-0 flex-col gap-8 overflow-y-auto p-4 md:p-8 lg:flex-row lg:gap-12 lg:overflow-hidden">
      <div className="flex min-h-[26rem] min-w-0 flex-1 flex-col gap-3 lg:min-h-0">
        <p className="font-mono text-xs uppercase">
          {summaryLine(login, total, firstYear, lastYear)}
        </p>
        <p
          aria-hidden="true"
          className="font-display text-[min(32vw,22dvh)] font-extrabold leading-[0.85]"
        >
          {formatCount(total)}
        </p>
        <YearBars
          firstYear={firstYear}
          lastYear={lastYear}
          yearBlocks={yearBlocks}
        />
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs">{FIXED_LINE}</p>
          {privateText && (
            <p className="font-mono text-xs leading-4">{privateText}</p>
          )}
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
