import type { ReactNode } from "react";
import { swatchClass } from "./palette";

/**
 * Classes for the list that holds the slides: a clipped stage on a phone.
 * `contain: paint` keeps the slides parked to the side from widening the
 * scene around it; the track itself is a deliberate clip.
 */
export const CAROUSEL_TRACK =
  "max-md:relative max-md:min-h-0 max-md:flex-1 max-md:touch-pan-y max-md:overflow-hidden max-md:[contain:paint]";

/**
 * Classes for each slide: on a phone every slide fills the track and is moved
 * by `--offset` (slides from the active one); from md up they are plain grid
 * items. A slide fully out of view is `data-off` and turns invisible once the
 * move ends.
 */
export const CAROUSEL_SLIDE =
  "max-md:absolute max-md:inset-0 max-md:[transform:translateX(calc(var(--offset,0)*100%))] max-md:transition-[transform,visibility] max-md:duration-[450ms] max-md:ease-[cubic-bezier(.65,0,.35,1)] max-md:data-[off]:invisible";

const arrow =
  "flex h-11 w-11 items-center justify-center border-2 border-ink font-mono text-sm enabled:cursor-pointer disabled:opacity-30";

type Props = {
  /** Developers in order, one slide each. */
  logins: readonly { login: string; slot: number }[];
  className?: string;
  /** The track (carrying `data-carousel-track`) with its slides. */
  children: ReactNode;
};

/**
 * Phone-only carousel shell: the scene's own list is the track and this adds
 * the buttons and dots below it (hidden from md up). `mountCarousel` wires it;
 * until then every control is disabled and the markup is the finished state.
 */
export function PhoneCarousel({ logins, className = "", children }: Props) {
  return (
    <div data-carousel className={`flex min-h-0 flex-col gap-2 ${className}`}>
      {children}
      <div className="flex shrink-0 items-center justify-between gap-2 md:hidden">
        <button
          type="button"
          data-carousel-prev
          disabled
          aria-label="Show previous developer"
          className={arrow}
        >
          ←
        </button>
        <div className="flex items-center">
          {logins.map(({ login, slot }, index) => (
            <button
              key={login.toLowerCase()}
              type="button"
              data-carousel-dot={index}
              disabled
              aria-label={`Show @${login}`}
              className="group flex h-11 w-11 items-center justify-center enabled:cursor-pointer"
            >
              <span
                className={`block h-2.5 w-3 opacity-40 transition-[width] duration-300 group-data-[active]:w-8 group-data-[active]:opacity-100 group-data-[pending]:opacity-20 ${swatchClass(slot)}`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          data-carousel-next
          disabled
          aria-label="Show next developer"
          className={arrow}
        >
          →
        </button>
      </div>
    </div>
  );
}
