import type { ComponentProps } from "react";
import { focusRing, pressable } from "./classes";

type StartButtonProps = ComponentProps<"button"> & {
  /** Fill color: the first year block, or ink on a colored block. */
  tone?: "block" | "ink";
  /** "cta" is the compact landing action; "stage" is the poster-sized one. */
  size?: "cta" | "stage";
};

/** The call to action. Reads "Play" unless told otherwise. */
export function StartButton({
  tone = "block",
  size = "stage",
  className = "",
  children = "Play",
  ...props
}: StartButtonProps) {
  // Hover flips to the other fill so the change reads on any block color.
  // Active: solid fill with paper text, hover flips to the other fill.
  // Disabled (aria-disabled): transparent, ink text, dashed border, same size.
  const fill =
    tone === "block"
      ? "border-block-ultramarine bg-block-ultramarine text-paper not-aria-disabled:hover:border-ink not-aria-disabled:hover:bg-ink"
      : "border-ink bg-ink text-paper not-aria-disabled:hover:border-block-ultramarine not-aria-disabled:hover:bg-block-ultramarine";
  const sizing =
    size === "cta"
      ? "inline-flex min-h-16 items-center justify-center gap-3 px-8 font-mono text-base font-bold uppercase tracking-[0.06em]"
      : "px-[0.4em] py-[0.25em] font-display text-[min(13vw,14dvh)] font-black uppercase leading-[0.85]";
  return (
    <button
      type="button"
      {...props}
      className={`${fill} ${sizing} border-2 text-center aria-disabled:cursor-not-allowed aria-disabled:border-dashed aria-disabled:border-ink aria-disabled:bg-transparent aria-disabled:text-ink aria-disabled:active:translate-y-0 ${pressable} ${focusRing} ${className}`}
    >
      {size === "cta" && <PlayIcon />}
      {children}
    </button>
  );
}

/** A small play triangle; the label next to it carries the meaning. */
function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 14 16"
      width={14}
      height={16}
      fill="currentColor"
    >
      <path d="M0 0l14 8-14 8z" />
    </svg>
  );
}
