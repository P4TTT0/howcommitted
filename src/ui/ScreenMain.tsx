import type { ComponentProps } from "react";

/** The full-viewport `main` every screen of the experience sits in. */
export function ScreenMain({
  className = "",
  ...props
}: ComponentProps<"main">) {
  return (
    <main
      className={`relative h-dvh w-full overflow-hidden bg-paper text-ink ${className}`}
      {...props}
    />
  );
}
