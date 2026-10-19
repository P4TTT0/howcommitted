"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";

/** Enough measure-and-shrink rounds to absorb rounding; the first one does most. */
const MAX_STEPS = 6;

type FitTextProps = {
  children: ReactNode;
  className?: string;
};

/**
 * One line of text that never wraps and never gets cut: it keeps the size its
 * class gives it (usually a `cqi` clamp) and shrinks only as far as the real,
 * measured width needs. Measuring beats guessing from a character count,
 * because every browser and OS lays the fonts out a little differently.
 */
export function FitText({ children, className = "" }: FitTextProps) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const text = inner.current;
    if (!box || !text) return;

    // Glyph widths do not scale exactly with the font size (hinting, rounding),
    // so one proportional step can still leave a few pixels over: measure
    // again after each step until it fits.
    const shrinkToFit = () => {
      text.style.fontSize = "";
      const available = box.clientWidth;
      if (available <= 0) return;
      for (let step = 0; step < MAX_STEPS; step += 1) {
        const natural = text.getBoundingClientRect().width;
        if (natural <= available) return;
        const size = Number.parseFloat(getComputedStyle(text).fontSize);
        text.style.fontSize = `${Math.floor(((size * available) / natural) * 0.98 * 10) / 10}px`;
      }
    };

    shrinkToFit();
    let width = box.clientWidth;
    const observer = new ResizeObserver(() => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      shrinkToFit();
    });
    observer.observe(box);
    let live = true;
    document.fonts?.ready.then(() => live && shrinkToFit());
    return () => {
      live = false;
      observer.disconnect();
    };
  });

  return (
    <span
      ref={outer}
      className={`block min-w-0 whitespace-nowrap ${className}`}
    >
      <span ref={inner} className="inline-block">
        {children}
      </span>
    </span>
  );
}
