"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import { swatchTextClass } from "@/features/versus/swatchText";
import { FIXED_LINE } from "@/og/poster";
import { interaction } from "@/playback/sound/interaction";
import { actionClass } from "@/ui/classes";
import { FitText } from "../finale/FitText";
import {
  type ShareOutcome,
  shareMessage,
  shareProfile,
} from "../finale/poster";
import type { PosterModel } from "./poster";
import type { VersusSummary } from "./summary";
import { VersusShareCards } from "./VersusShareCards";
import { buildVersusCards } from "./versusCards";

type Props = {
  summaries: readonly VersusSummary[];
  poster: PosterModel;
  onReplay: () => void;
};

/** The mono caption style used across the poster. */
const MONO = "font-mono [font-stretch:87.5%]";

/** The poster action: 48px tall, mono caps. */
const ACTION = `${actionClass} min-h-12 px-2 md:px-3`;

/** GitHub avatar in a paper circle; the initial shows if it cannot load. */
function Avatar({ login }: { login: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper font-display text-lg font-black text-ink md:size-10 md:text-[22px]">
      {login.charAt(0).toUpperCase()}
      {!failed && (
        // biome-ignore lint/performance/noImgElement: a 40px avatar, no optimizer needed
        <img
          src={`https://github.com/${encodeURIComponent(login)}.png?size=80`}
          alt=""
          width={40}
          height={40}
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/** "@ada vs @lin · 2013 — 2026" */
function lineupLabel(poster: PosterModel): string {
  const lineup = poster.people.map((person) => `@${person.login}`).join(" vs ");
  if (!poster.years) return lineup;
  const { first, last } = poster.years;
  return `${lineup} · ${first === last ? first : `${first} — ${last}`}`;
}

/**
 * The versus poster: an ink block with the sum of everyone and one band per
 * developer, then the share cards. A band's width (its height on a phone) is
 * its share of the combined total, never below a readable minimum. That only
 * shows how the total splits: nothing here orders or compares anyone.
 */
export function VersusEndCard({ summaries, poster, onReplay }: Props) {
  const [message, setMessage] = useState("");
  const cards = useMemo(() => buildVersusCards(poster), [poster]);
  const sum = Math.max(1, poster.total);

  async function onShare() {
    setMessage("");
    const logins = poster.people.map((person) => person.login);
    const url = `${window.location.origin}/${logins.map(encodeURIComponent).join("/")}`;
    const outcome: ShareOutcome = await shareProfile(
      {
        title: `${logins.map((login) => `@${login}`).join(" vs ")} | Committed`,
        text: "Contribution history, side by side.",
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
  }

  return (
    <section
      aria-label="Versus summary"
      className="flex min-h-full flex-col gap-3 p-4 md:h-full md:gap-5 md:px-[clamp(1.5rem,4.5vw,4rem)] md:py-[clamp(1rem,4vh,2.5rem)] lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:grid-rows-[minmax(0,1fr)] lg:gap-10"
    >
      <h2 className="sr-only">Versus</h2>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 bg-ink p-4 text-paper md:gap-[clamp(0.5rem,2vh,1.125rem)] md:px-8 md:py-[clamp(1rem,3.5vh,1.875rem)]">
        <div
          className={`${MONO} flex flex-wrap justify-between gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.06em] md:text-[13px]`}
        >
          <p className="min-w-0 [overflow-wrap:anywhere]">
            {lineupLabel(poster)}
          </p>
          {poster.privateTotal > 0 && (
            <p>Includes {formatCount(poster.privateTotal)} private</p>
          )}
        </div>
        <div>
          <div className="font-display text-[clamp(4.5rem,24vw,6rem)] font-black leading-[0.78] tabular-nums md:text-[clamp(5rem,min(12.5vw,20vh),12.5rem)]">
            <FitText>{formatCount(poster.total)}</FitText>
          </div>
          <p className="mt-1 font-display text-[clamp(1.5rem,7vw,1.875rem)] font-black uppercase leading-none text-block-signal md:mt-2 md:text-[clamp(1.5rem,min(3.6vw,6vh),3.5rem)]">
            Contributions, together.
          </p>
        </div>

        <ul className="flex min-h-[22rem] flex-1 flex-col gap-1 md:min-h-0 md:flex-row">
          {summaries.map((summary, index) => {
            const person = poster.people[index];
            return (
              <li
                key={summary.login.toLowerCase()}
                data-role="dev-band"
                // The share sets how much extra room a band takes. On a phone
                // a band starts at its content height, so a small share never
                // squeezes the login and awards out of it.
                style={{ flexGrow: summary.total / sum }}
                className={`grid min-w-0 grid-cols-[minmax(0,1fr)_45%] items-center gap-x-2 gap-y-1 p-3 max-md:min-h-16 max-md:basis-auto md:min-w-[6.5rem] md:basis-0 md:grid-cols-1 md:content-between md:items-start md:p-4 ${swatchClass(index)} ${swatchTextClass(index)}`}
              >
                <div className="col-start-1 flex min-w-0 items-center gap-2">
                  <Avatar login={summary.login} />
                  <span
                    className={`${MONO} min-w-0 text-xs font-bold leading-tight [overflow-wrap:anywhere] md:truncate`}
                    title={`@${summary.login}`}
                  >
                    @{summary.login}
                  </span>
                </div>
                <div className="col-start-2 row-span-2 row-start-1 text-right font-display text-[2.125rem] font-black leading-[0.9] tabular-nums md:order-2 md:col-start-1 md:row-span-1 md:row-start-auto md:text-left md:text-[clamp(2rem,min(4vw,7vh),3.5rem)]">
                  <FitText>{formatCount(summary.total)}</FitText>
                </div>
                <div className="col-start-1 min-w-0 md:order-3">
                  <p className="sr-only">
                    {summary.totalText} · {summary.span}
                  </p>
                  {person && person.awards.length > 0 && (
                    <ul
                      className={`${MONO} flex flex-col text-[11px] uppercase [overflow-wrap:anywhere]`}
                    >
                      {person.awards.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className={`${MONO} text-[11px] md:text-[13px]`}>{FIXED_LINE}</p>
      </div>

      <VersusShareCards cards={cards} message={message} onMessage={setMessage}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:col-start-2 lg:col-start-1 lg:mt-auto">
          <button
            type="button"
            onClick={() => {
              interaction.click();
              onShare();
            }}
            className={ACTION}
          >
            Share
          </button>
          <button
            type="button"
            onClick={() => {
              interaction.click();
              onReplay();
            }}
            className={ACTION}
          >
            Replay
          </button>
          <Link
            href="/"
            onClick={() => interaction.click()}
            className={`${ACTION} bg-block-signal font-bold text-ink max-md:col-span-2`}
          >
            Search again
          </Link>
        </div>
      </VersusShareCards>
    </section>
  );
}
