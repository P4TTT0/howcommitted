"use client";

import type { ReactNode } from "react";
import { interaction } from "@/playback/sound/interaction";

type ClickLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** An anchor that clicks on press (when site sound is on), for server components. */
export function ClickLink({ href, className, children }: ClickLinkProps) {
  return (
    <a href={href} className={className} onClick={() => interaction.click()}>
      {children}
    </a>
  );
}
