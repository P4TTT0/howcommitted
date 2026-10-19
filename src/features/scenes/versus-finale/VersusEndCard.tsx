"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
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
import { renderPosterImage, savePosterImage } from "./posterImage";
import type { VersusSummary } from "./summary";

type Props = {
  summaries: readonly VersusSummary[];
  poster: PosterModel;
  onReplay: () => void;
};

/** Color header height: fixed so every card is the same size. */
const HEADER =
  "grid-rows-[auto] md:grid-rows-[clamp(7.5rem,22vh,12rem)_minmax(0,1fr)]";

/** The mono caption style used across the poster. */
const MONO = "font-mono [font-stretch:87.5%]";

/** The poster action: 44px+ tall, mono caps, two by two on a phone. */
const ACTION = `${actionClass} min-h-12 md:px-5 max-md:w-full`;

/** GitHub avatar in a paper circle; the initial shows if it cannot load. */
function Avatar({ login }: { login: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper font-display text-xl font-black text-ink">
      {login.charAt(0).toUpperCase()}
      {!failed && (
        // biome-ignore lint/performance/noImgElement: a 36px avatar, no optimizer needed
        <img
          src={`https://github.com/${encodeURIComponent(login)}.png?size=80`}
          alt=""
          width={36}
          height={36}
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/** "Together, 2016 to 2026" as the poster caption: "Together · 2016 — 2026". */
function togetherLabel(together: string): string {
  return together.replace(", ", " · ").replace(" to ", " — ");
}

const SAVE_FAILED = "The image could not be made. Try again.";

/**
 * The versus poster: the sum of everyone, then one block per developer in the
 * order they were added with their calendar total, years and awards. Same
 * size, same weight: nothing here orders or compares them. Rows on a phone,
 * columns from tablet width. Small type always sits on Paper (a chip or the
 * strip under the block), never on a swatch.
 */
export function VersusEndCard({ summaries, poster, onReplay }: Props) {
  const saveRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState("");
  // The image is drawn ahead of the click, so saving never awaits before it
  // reaches the share sheet or the download (the browser needs the gesture).
  const [image, setImage] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  // The scenes just ended: move focus to the obvious next action.
  useEffect(() => saveRef.current?.focus(), []);
  useEffect(() => {
    let current = true;
    setImage(null);
    setFailed(false);
    renderPosterImage(poster).then(
      (blob) => current && setImage(blob),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [poster]);

  function onSave() {
    setMessage("");
    if (failed) {
      setMessage(SAVE_FAILED);
      return;
    }
    if (!image) {
      setMessage("The image is still being drawn. Try again in a moment.");
      return;
    }
    savePosterImage(image).then(
      (outcome) =>
        setMessage(
          outcome === "downloaded"
            ? "Download started."
            : outcome === "shared"
              ? "Image shared."
              : "",
        ),
      () => setMessage(SAVE_FAILED),
    );
  }

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

  const [lead, ...rest] = poster.sentence.split(" ");
  return (
    <section
      aria-label="Versus summary"
      className="flex min-h-full flex-col gap-4 p-4 md:h-full md:gap-[clamp(0.75rem,2.4vh,1.25rem)] md:px-[clamp(1.5rem,4.5vw,4rem)] md:py-[clamp(1rem,5vh,3rem)]"
    >
      <h2 className="sr-only">Versus</h2>
      <header className="flex flex-col gap-1 md:flex-row md:items-end md:gap-7">
        <div className="font-display text-[clamp(4.5rem,24vw,5.5rem)] font-black leading-[0.8] tabular-nums md:w-[42%] md:shrink-0 md:text-[clamp(5rem,min(12.5vw,20vh),11.25rem)]">
          <FitText>{formatCount(poster.total)}</FitText>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 md:pb-1.5">
          <p className={`${MONO} text-xs uppercase tracking-[0.06em]`}>
            {togetherLabel(poster.together)}
          </p>
          <p className="font-display text-[clamp(1.5rem,7vw,2rem)] font-black uppercase leading-[0.9] md:text-[clamp(1.5rem,min(3.4vw,5.6vh),3rem)]">
            {lead}
            <br className="max-md:hidden" /> {rest.join(" ")}
          </p>
        </div>
      </header>

      <ul
        style={{ "--n": summaries.length } as CSSProperties}
        className="grid min-h-0 gap-2 md:flex-1 md:grid-cols-[repeat(var(--n),minmax(0,1fr))] md:gap-4"
      >
        {summaries.map((summary, index) => {
          const person = poster.people[index];
          return (
            <li
              key={summary.login.toLowerCase()}
              data-role="dev-card"
              className={`grid min-h-0 min-w-0 border-2 border-ink ${HEADER}`}
            >
              <div
                className={`flex min-w-0 items-center justify-between gap-3 p-3 md:flex-col md:items-stretch md:justify-between md:p-[clamp(0.625rem,1.4vw,1.25rem)] ${swatchClass(index)} ${swatchTextClass(index)}`}
              >
                <div className="flex min-w-0 items-center gap-2 md:flex-col md:items-start lg:flex-row lg:items-center">
                  <Avatar login={summary.login} />
                  <span className="min-w-0 [overflow-wrap:anywhere] bg-paper px-2 py-0.5 font-mono text-[11px] font-bold leading-tight text-ink lg:text-xs [font-stretch:87.5%]">
                    @{summary.login}
                  </span>
                </div>
                <div className="w-[45%] shrink-0 text-right font-display text-[2.25rem] font-black leading-[0.8] tabular-nums md:w-auto md:text-left md:text-[clamp(2.5rem,min(7vw,13vh),6rem)]">
                  <FitText>{formatCount(summary.total)}</FitText>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2.5 bg-paper p-3 md:px-[clamp(0.625rem,1.4vw,1.25rem)] md:py-3.5">
                <p className={`${MONO} text-xs [overflow-wrap:anywhere]`}>
                  {summary.totalText} · {summary.span}
                </p>
                {person && person.awards.length > 0 && (
                  <ul className="flex flex-col gap-1 border-t-2 border-ink pt-2.5">
                    {person.awards.map((title) => (
                      <li
                        key={title}
                        className="font-display text-xl font-black uppercase leading-none [overflow-wrap:anywhere] md:text-[clamp(1.125rem,3.6vh,1.875rem)]"
                      >
                        {title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className={`${MONO} min-w-0 text-xs md:text-[13px]`}>
          <p>
            {FIXED_LINE}
            {poster.privateTotal > 0 && (
              <span className="opacity-60">
                {" "}
                Includes {formatCount(poster.privateTotal)} private.
              </span>
            )}
          </p>
          <p role="status" className="empty:hidden">
            {message}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
          <button
            ref={saveRef}
            type="button"
            onClick={() => {
              interaction.click();
              onSave();
            }}
            className={`${ACTION} bg-ink font-bold text-paper`}
          >
            Save image
          </button>
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
            className={`${ACTION} bg-block-signal font-bold text-ink`}
          >
            Search again
          </Link>
        </div>
      </div>
    </section>
  );
}
