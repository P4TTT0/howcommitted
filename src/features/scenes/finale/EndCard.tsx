"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import { actionClass } from "@/ui/classes";
import { posterFacts, type ShareCard } from "./cards";
import { FitText } from "./FitText";
import {
  challengeHref,
  FIXED_LINE,
  posterTopLine,
  privateTag,
  type ShareOutcome,
  shareMessage,
  shareProfile,
} from "./poster";
import { ShareCards } from "./ShareCards";

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
  /** Private contributions included in `total`; the tag omits them at 0. */
  privateContributions: number;
  /** Versus only exists outside production; the action is hidden otherwise. */
  versusEnabled: boolean;
  onReplay: () => void;
};

/**
 * The final poster: a color block with the big total and a few facts, then the
 * cards to take away. Every line of text in the block measures its real width
 * and shrinks to stay on one line; none of it wraps or is cut.
 */
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

  const facts = posterFacts(cards);
  const tag = privateTag(privateContributions);

  const actions = (
    <div className="mt-auto flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 [&>*]:flex-auto">
        <button
          ref={shareRef}
          type="button"
          onClick={onShare}
          className={actionClass}
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
        <Link href="/" className={`${actionClass} bg-block-signal`}>
          Search again
        </Link>
      </div>
      <p role="status" className="font-mono text-xs">
        {message}
      </p>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-4 md:gap-6 md:overflow-hidden md:p-8 lg:flex-row lg:gap-10">
      <div className="flex min-w-0 shrink-0 flex-col justify-between gap-6 bg-block-ultramarine p-5 text-paper [container-type:inline-size] md:shrink-0 md:p-6 lg:p-8 lg:min-h-0 lg:flex-1 lg:shrink lg:gap-4">
        <div className="flex flex-col gap-1 font-mono text-xs uppercase [font-stretch:87.5%] md:flex-row md:justify-between md:gap-4 md:text-[13px]">
          <FitText className="md:flex-1">
            {posterTopLine(login, firstYear, lastYear)}
          </FitText>
          {tag && <span className="whitespace-nowrap md:shrink-0">{tag}</span>}
        </div>
        <div className="flex flex-col gap-2">
          <FitText className="font-display text-[length:min(26cqi,16dvh)] lg:text-[length:min(38cqi,28dvh)] font-extrabold leading-[0.8]">
            {formatCount(total)}
          </FitText>
          <FitText className="font-display text-[length:min(11cqi,6dvh)] lg:text-[length:min(11cqi,8dvh)] font-extrabold uppercase leading-none text-block-signal">
            {total === 1 ? "Contribution." : "Contributions."}
          </FitText>
        </div>
        {facts.length > 0 && (
          <dl
            className="m-0 grid grid-cols-2 border-t-2 border-paper md:[grid-template-columns:repeat(var(--facts),minmax(0,1fr))]"
            style={{ "--facts": facts.length } as CSSProperties}
          >
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="flex min-w-0 flex-col gap-1.5 pr-3 pt-3 [container-type:inline-size]"
              >
                <dt className="font-mono text-[11px] uppercase [font-stretch:87.5%]">
                  <FitText>{fact.label}</FitText>
                </dt>
                <dd className="m-0">
                  <FitText className="font-display text-[length:min(40px,22cqi)] font-extrabold uppercase leading-[0.95]">
                    {fact.value}
                  </FitText>
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-col gap-1 font-mono text-xs">
          <p>{FIXED_LINE}</p>
          {note && <p className="leading-4">{note}</p>}
        </div>
      </div>
      {cards.length > 0 ? (
        <ShareCards cards={cards}>{actions}</ShareCards>
      ) : (
        actions
      )}
    </div>
  );
}
