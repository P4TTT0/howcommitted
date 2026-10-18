"use client";

import { useEffect, useRef, useState } from "react";
import { actionClass, focusRing } from "@/ui/classes";
import {
  type CardFonts,
  cardToBlob,
  drawCard,
  loadCardFonts,
  readCardFonts,
} from "./cardCanvas";
import type { ShareCard } from "./cards";

/** Width, in px, a picker thumbnail is drawn at before CSS scales it. */
const THUMB_WIDTH = 270;

type ShareCardsProps = { cards: readonly ShareCard[] };

/**
 * "Take it with you": pick one of the share cards and save it as a 9:16 PNG.
 * The cards are drawn in the browser from the history already on screen, so
 * nothing is uploaded, cached or fetched, and the saved file is the same
 * drawing as the thumbnail.
 */
export function ShareCards({ cards }: ShareCardsProps) {
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const fontsRef = useRef<CardFonts | null>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  // The finale re-renders with fresh (equal) cards; only a change in content redraws.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const contentKey = JSON.stringify(cards);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `contentKey` is the content of `cards`; the ref holds the latest copy
  useEffect(() => {
    let cancelled = false;
    const fonts = readCardFonts();
    fontsRef.current = fonts;
    loadCardFonts(fonts)
      .catch(() => {
        // Draw with whatever the browser has: a fallback font beats no card.
      })
      .then(() => {
        if (cancelled) return;
        cardsRef.current.forEach((card, index) => {
          const canvas = canvases.current[index];
          if (canvas) drawCard(canvas, card, fonts, THUMB_WIDTH);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [contentKey]);

  const card = cards[selected] ?? cards[0];
  if (!card) return null;

  const save = async () => {
    const fonts = fontsRef.current ?? readCardFonts();
    setSaving(true);
    setStatus("");
    try {
      const blob = await cardToBlob(card, fonts);
      if (!blob) throw new Error("empty image");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${card.filename}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus(`Saved the ${card.label.toLowerCase()} card.`);
    } catch {
      setStatus("Could not save the image. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="take-it-heading"
      className="flex min-w-0 flex-col gap-3 lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto"
    >
      <h2
        id="take-it-heading"
        className="font-display text-5xl font-black uppercase leading-[0.9]"
      >
        Take it with you.
      </h2>
      <p className="font-mono text-xs leading-[1.6] [font-stretch:87.5%]">
        Pick a card. It saves as an image, sized for stories.
      </p>
      <ul className="grid grid-cols-3 gap-3">
        {cards.map((item, index) => {
          const isSelected = index === selected;
          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${item.label} card`}
                title={item.alt}
                onClick={() => setSelected(index)}
                className={`flex w-full min-h-11 flex-col gap-1.5 text-left font-mono text-xs uppercase [font-stretch:87.5%] ${focusRing} ${isSelected ? "font-bold" : ""}`}
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
        onClick={save}
        disabled={saving}
        className={`${actionClass} min-h-14 bg-ink text-paper disabled:opacity-100`}
      >
        {saving ? "Saving" : "Save image"}
      </button>
      <p role="status" className="min-h-4 font-mono text-xs">
        {status}
      </p>
    </section>
  );
}
