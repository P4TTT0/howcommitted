import { focusRing, pressable } from "@/ui/classes";
import { ClickLink } from "./ClickLink";
import { SoundToggle } from "./SoundToggle";

const linkClass = `underline decoration-1 underline-offset-[3px] hover:text-block-ultramarine ${pressable} ${focusRing}`;

/**
 * The author's signature on the left, the links on the right. The headline
 * already reads "How committed", so the page title is for screen readers only.
 */
export function LandingHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[clamp(1rem,4vw,3rem)] py-3 [@media(max-height:520px)]:py-1">
      <h1 className="sr-only">How Committed</h1>
      <p className="inline-flex min-h-11 items-center gap-[0.5ch] font-mono text-[13px]">
        By
        <ClickLink href="https://github.com/P4TTT0" className={linkClass}>
          @P4TTT0
        </ClickLink>
      </p>
      <nav
        aria-label="About"
        className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[13px]"
      >
        <ClickLink
          href="https://github.com/P4TTT0/howcommitted"
          className={`${linkClass} inline-flex min-h-11 items-center`}
        >
          GitHub
        </ClickLink>
        <ClickLink
          href="https://www.linkedin.com/in/pperezcardenal"
          className={`${linkClass} inline-flex min-h-11 items-center`}
        >
          LinkedIn
        </ClickLink>
        <SoundToggle />
      </nav>
    </header>
  );
}
