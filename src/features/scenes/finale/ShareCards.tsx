"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { interaction } from "@/playback/sound/interaction";
import { actionClass, focusRing } from "@/ui/classes";
import { cardToBlob, drawCard } from "./cardCanvas";
import { type CardFonts, loadCardFonts, readCardFonts } from "./cardPrimitives";
import type { ShareCard } from "./cards";

/** Width, in px, a picker thumbnail is drawn at before CSS scales it. */
const THUMB_WIDTH = 270;
/** The saved image's object URL lives this long, so a slow download still finds it. */
const REVOKE_AFTER_MS = 30_000;

type ShareCardsProps = {
  cards: readonly ShareCard[];
  /** The poster actions (share, replay, search), placed under the save button. */
  children?: ReactNode;
};

type Prepared = { card: ShareCard; blob: Blob | null };

/** A phone or tablet: the share sheet is the way to stories, not a download. */
function prefersShareSheet(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function startDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking right away can cancel the download on some mobile browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/**
 * "Take it with you": pick one of the share cards and save it as a 9:16 PNG.
 * The cards are drawn in the browser from the history already on screen, so
 * nothing is uploaded, cached or fetched, and the saved file is the same
 * drawing as the thumbnail. The chosen card's image is rendered ahead of the
 * click, so saving starts inside the user's gesture (mobile browsers drop a
 * share or download that waits on async work).
 */
export function ShareCards({ cards, children }: ShareCardsProps) {
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState("");
  const [fonts, setFonts] = useState<CardFonts | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  const card = cards[selected] ?? cards[0];

  useEffect(() => {
    let cancelled = false;
    const families = readCardFonts();
    loadCardFonts(families).then(() => {
      if (cancelled) return;
      cards.forEach((item, index) => {
        const canvas = canvases.current[index];
        if (canvas) drawCard(canvas, item, families, THUMB_WIDTH);
      });
      setFonts(families);
    });
    return () => {
      cancelled = true;
    };
  }, [cards]);

  useEffect(() => {
    if (!fonts || !card) return;
    let cancelled = false;
    cardToBlob(card, fonts).then((blob) => {
      if (!cancelled) setPrepared({ card, blob });
    });
    return () => {
      cancelled = true;
    };
  }, [fonts, card]);

  if (!card) return null;

  const blob = prepared?.card === card ? prepared.blob : null;
  const failed = prepared?.card === card && prepared.blob === null;

  const save = () => {
    if (!blob) return;
    const filename = `${card.filename}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    const saved = () =>
      setStatus(`Download started for the ${card.label.toLowerCase()} card.`);

    if (prefersShareSheet() && navigator.canShare?.({ files: [file] })) {
      navigator
        .share({ files: [file], title: `@${card.login} | Committed` })
        .then(() => setStatus(`Shared the ${card.label.toLowerCase()} card.`))
        .catch((error: unknown) => {
          // Closing the sheet is a choice, not a failure.
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          startDownload(blob, filename);
          saved();
        });
      return;
    }
    startDownload(blob, filename);
    saved();
  };

  return (
    <section
      aria-labelledby="take-it-heading"
      className="flex min-w-0 shrink-0 flex-col gap-3 lg:w-[460px] lg:overflow-y-auto"
    >
      <h2
        id="take-it-heading"
        className="font-mono text-xs font-bold uppercase [font-stretch:87.5%]"
      >
        Take it with you.
      </h2>
      <ul className="grid grid-cols-3 gap-3 md:max-w-[20rem] lg:max-w-none">
        {cards.map((item, index) => {
          const isSelected = index === selected;
          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${item.label} card`}
                title={item.alt}
                onClick={() => {
                  interaction.click();
                  setSelected(index);
                  setStatus("");
                }}
                className={`flex min-h-11 w-full flex-col gap-1.5 text-left font-mono text-xs uppercase [font-stretch:87.5%] ${focusRing} ${isSelected ? "font-bold" : ""}`}
              >
                <canvas
                  ref={(node) => {
                    canvases.current[index] = node;
                  }}
                  className={`block aspect-[9/16] w-full ${isSelected ? "outline-[3px] outline-offset-[3px] outline-ink" : ""}`}
                />
                <span aria-hidden="true">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => {
          interaction.click();
          save();
        }}
        disabled={!blob}
        className={`${actionClass} min-h-14 bg-ink text-paper disabled:border-dashed disabled:bg-transparent disabled:text-ink`}
      >
        Save {card.label.toLowerCase()} image
      </button>
      <p role="status" className="min-h-4 font-mono text-xs">
        {failed ? "Could not prepare this card. Try another one." : status}
      </p>
      {children}
    </section>
  );
}
