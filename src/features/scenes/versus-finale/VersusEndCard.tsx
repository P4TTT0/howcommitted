"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { formatCount } from "@/features/sequencer/model/format";
import { swatchClass } from "@/features/versus/palette";
import { swatchTextClass } from "@/features/versus/swatchText";
import { FIXED_LINE } from "@/og/poster";
import { actionClass } from "@/ui/classes";
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

/** Wide screens give every developer a column, up to the five a lineup holds. */
const WIDE_COLUMNS: Record<number, string> = {
  1: "md:grid-cols-1 lg:grid-cols-1",
  2: "md:grid-cols-2 lg:grid-cols-2",
  3: "md:grid-cols-3 lg:grid-cols-3",
  4: "md:grid-cols-3 lg:grid-cols-4",
  5: "md:grid-cols-3 lg:grid-cols-5",
};

/**
 * Font size for a total so it always fits its block: about half an em per
 * character (digits and commas of Big Shoulders), as container-width units.
 */
function totalSize(total: string): CSSProperties {
  return {
    "--total": `${(100 / (total.length * 0.5)).toFixed(1)}cqw`,
  } as CSSProperties;
}

/** Four to a row on a phone: tighter padding, labels may take two lines. */
const PHONE_ACTION =
  "max-sm:px-1! max-sm:text-center max-sm:text-[11px] max-sm:leading-tight";

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

  return (
    <section
      aria-label="Versus summary"
      className="flex min-h-full flex-col gap-3 p-4 md:gap-4 md:px-16 md:pt-12 md:pb-6"
    >
      <h2 className="sr-only">Versus</h2>
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-[0.06em] [font-stretch:87.5%]">
          {poster.together}
        </p>
        <p className="font-display text-[clamp(3.5rem,13vw,9.5rem)] font-black leading-[0.85] tabular-nums">
          <span aria-hidden="true" className="block">
            {formatCount(poster.total)}
          </span>
          <span className="sr-only">
            {formatCount(poster.total)} contributions
          </span>
        </p>
        <p className="font-display text-[clamp(1.25rem,3.4vw,2.75rem)] font-extrabold uppercase leading-none">
          {poster.sentence}
        </p>
      </header>

      <ul
        className={`grid min-h-0 flex-1 gap-2 md:gap-4 ${WIDE_COLUMNS[summaries.length] ?? "md:grid-cols-5"}`}
      >
        {summaries.map((summary, index) => {
          const person = poster.people[index];
          return (
            <li
              key={summary.login.toLowerCase()}
              className="flex min-w-0 border-2 border-ink md:flex-col"
            >
              <div
                className={`@container flex w-[42%] min-w-0 shrink-0 flex-col items-start justify-between gap-1.5 p-2.5 md:w-auto md:flex-1 md:gap-4 md:p-4 ${swatchClass(index)} ${swatchTextClass(index)}`}
              >
                <span className="max-w-full min-w-0 [overflow-wrap:anywhere] bg-paper px-2 py-0.5 font-mono text-xs font-bold text-ink">
                  @{summary.login}
                </span>
                <span
                  aria-hidden="true"
                  style={totalSize(formatCount(summary.total))}
                  className="max-w-full font-display text-[min(var(--total),3rem)] font-black leading-[0.85] tabular-nums md:text-[min(var(--total),5rem)]"
                >
                  {formatCount(summary.total)}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 bg-paper p-2.5 md:flex-none md:p-4">
                <p className="font-mono text-xs">
                  {summary.totalText}, {summary.span}
                </p>
                {person && person.awards.length > 0 && (
                  <ul className="flex flex-col gap-0.5 md:border-t-2 md:border-ink md:pt-2.5">
                    {person.awards.map((title) => (
                      <li
                        key={title}
                        className="font-display text-lg font-extrabold uppercase leading-none [overflow-wrap:anywhere] md:text-[26px]"
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

      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs">{FIXED_LINE}</p>
        {poster.privateNote && (
          <p className="font-mono text-xs [overflow-wrap:anywhere]">
            {poster.privateNote}
          </p>
        )}
      </div>
      <div className="grid grid-cols-4 items-center gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
        <button
          ref={saveRef}
          type="button"
          onClick={onSave}
          className={`${actionClass} ${PHONE_ACTION} bg-ink text-paper`}
        >
          Save image
        </button>
        <button
          type="button"
          onClick={onShare}
          className={`${actionClass} ${PHONE_ACTION}`}
        >
          Share
        </button>
        <button
          type="button"
          onClick={onReplay}
          className={`${actionClass} ${PHONE_ACTION}`}
        >
          Replay
        </button>
        <Link href="/" className={`${actionClass} ${PHONE_ACTION}`}>
          Search again
        </Link>
        <p
          role="status"
          className="col-span-4 font-mono text-xs empty:hidden sm:col-auto"
        >
          {message}
        </p>
      </div>
    </section>
  );
}
