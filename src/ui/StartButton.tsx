import type { ComponentProps } from "react";
import { focusRing, pressable } from "./classes";

type StartButtonProps = ComponentProps<"button"> & {
  /** Fill color: the first year block, or ink on a colored block. */
  tone?: "block" | "ink";
  /** "cta" is the compact landing action; "stage" is the poster-sized one. */
  size?: "cta" | "stage";
};

/** The call to action. Reads "How Committed?" unless told otherwise. */
export function StartButton({
  tone = "block",
  size = "stage",
  className = "",
  children = "How Committed?",
  ...props
}: StartButtonProps) {
  // Hover flips to the other fill so the change reads on any block color.
  const fill =
    tone === "block"
      ? "bg-block-ultramarine not-aria-disabled:hover:bg-ink"
      : "bg-ink not-aria-disabled:hover:bg-block-ultramarine";
  const sizing =
    size === "cta"
      ? "min-h-16 px-8 font-mono text-base font-bold uppercase tracking-[0.06em]"
      : "px-[0.4em] py-[0.25em] font-display text-[min(13vw,14dvh)] font-black uppercase leading-[0.85]";
  return (
    <button
      type="button"
      {...props}
      className={`${fill} ${sizing} text-center text-paper aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:active:translate-y-0 ${pressable} ${focusRing} ${className}`}
    >
      {children}
    </button>
  );
}
