import type { ComponentProps } from "react";
import { focusRing } from "./classes";

type StartButtonProps = ComponentProps<"button"> & {
  /** Fill color: the first year block, or ink on a colored block. */
  tone?: "block" | "ink";
  /** "form" fills a form row; "stage" is the poster-sized call to action. */
  size?: "form" | "stage";
};

/** The "How Committed?" call to action. */
export function StartButton({
  tone = "block",
  size = "stage",
  className = "",
  ...props
}: StartButtonProps) {
  const fill = tone === "block" ? "bg-block-ultramarine" : "bg-ink";
  const sizing =
    size === "form"
      ? "min-h-14 w-full px-6 py-3 text-[clamp(2.5rem,9vw,4.5rem)]"
      : "px-[0.4em] py-[0.25em] text-[min(13vw,14dvh)]";
  return (
    <button
      type="button"
      {...props}
      className={`${fill} ${sizing} text-center font-display font-black uppercase leading-[0.85] text-paper aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${focusRing} ${className}`}
    >
      How Committed?
    </button>
  );
}
