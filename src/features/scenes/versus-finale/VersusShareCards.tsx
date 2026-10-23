"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type CardFonts,
  loadCardFonts,
  readCardFonts,
} from "@/features/scenes/finale/cardPrimitives";
import { interaction } from "@/playback/sound/interaction";
import { actionClass, focusRing } from "@/ui/classes";
import { drawVersusCard, versusCardToBlob } from "./versusCardCanvas";
import type { VersusCard } from "./versusCards";

/** Width, in px, a picker thumbnail is drawn at before CSS scales it. */
const THUMB_WIDTH = 270;
/** The saved image's object URL lives this long, so a slow download still finds it. */
const REVOKE_AFTER_MS = 30_000;

type Props = {
  cards: readonly VersusCard[];
  message: string;
  onMessage: (message: string) => void;
  /** Share, Replay and Search again, placed under the save button. */
  children?: ReactNode;
};

type Prepared = { card: VersusCard; blob: Blob | null };

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
 * "Take it with you": pick one of the three versus cards and save it as a 9:16
 * PNG. Cards are drawn in the browser from the poster's data; the thumbnail
 * and the saved file are the same drawing. The chosen card's image is rendered
 * ahead of the click, so saving starts inside the user's gesture.
 */
export function VersusShareCards({
  cards,
  message,
  onMessage,
  children,
}: Props) {
  const [selected, setSelected] = useState(0);
  const [fonts, setFonts] = useState<CardFonts | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const firstRef = useRef<HTMLButtonElement>(null);

  const card = cards[selected] ?? cards[0];

  // The poster just appeared: move focus to the obvious next step.
  useEffect(() => firstRef.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    const families = readCardFonts();
    loadCardFonts(families).then(() => {
      if (cancelled) return;
      cards.forEach((item, index) => {
        const canvas = canvases.current[index];
        if (canvas) drawVersusCard(canvas, item, families, THUMB_WIDTH);
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
    versusCardToBlob(card, fonts).then((blob) => {
      if (!cancelled) setPrepared({ card, blob });
    });
    return () => {
      cancelled = true;
    };
  }, [fonts, card]);

  if (!card) return null;

  const blob = prepared?.card === card ? prepared.blob : null;
  const failed = prepared?.card === card && prepared.blob === null;
  const name = card.label.toLowerCase();

  const save = () => {
    if (!blob) return;
    const filename = `${card.filename}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    const saved = () => onMessage(`Download started for the ${name} card.`);

    if (prefersShareSheet() && navigator.canShare?.({ files: [file] })) {
      navigator
        .share({ files: [file], title: `${card.lineup} | How Committed` })
        .then(() => onMessage(`Shared the ${name} card.`))
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
      aria-labelledby="versus-take-it-heading"
      className="flex min-w-0 flex-col gap-3 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:content-start md:gap-x-6 md:gap-y-3 lg:min-h-0 lg:grid-cols-1"
    >
      <h2
        id="versus-take-it-heading"
        className="font-mono text-xs font-bold uppercase tracking-[0.06em] [font-stretch:87.5%] md:col-span-2 lg:col-span-1"
      >
        Take it with you
      </h2>
      <ul className="grid grid-cols-3 gap-2 md:col-start-1 md:row-span-3 md:row-start-2 md:gap-3 lg:row-span-1">
        {cards.map((item, index) => {
          const isSelected = index === selected;
          return (
            <li key={item.id} className="min-w-0">
              <button
                ref={index === 0 ? firstRef : undefined}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${item.label} card`}
                title={item.alt}
                onClick={() => {
                  interaction.click();
                  setSelected(index);
                  onMessage("");
                }}
                className={`flex min-h-11 w-full flex-col gap-1.5 text-left font-mono text-[11px] uppercase [font-stretch:87.5%] ${focusRing} ${isSelected ? "font-bold" : ""}`}
              >
                <canvas
                  ref={(node) => {
                    canvases.current[index] = node;
                  }}
                  className={`block aspect-[9/16] max-md:h-24 max-md:w-auto md:w-full ${isSelected ? "outline-[3px] outline-offset-[3px] outline-ink" : ""}`}
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
        className={`${actionClass} min-h-12 w-full bg-ink font-bold text-paper md:col-start-2 md:min-h-14 lg:col-start-1 disabled:border-dashed disabled:bg-transparent disabled:text-ink`}
      >
        Save {name} image
      </button>
      <p
        role="status"
        className="min-h-4 font-mono text-xs empty:hidden md:col-start-2 lg:col-start-1"
      >
        {failed ? "Could not prepare this card. Try another one." : message}
      </p>
      {children}
    </section>
  );
}
