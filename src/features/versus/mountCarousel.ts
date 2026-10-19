import type { SceneRuntime } from "@/features/sequencer/types";
import { interaction } from "@/playback/sound/interaction";
import { activeAt, slideOffset, stepIndex, swipeStep } from "./carousel";
import { revealTime } from "./reveal";

/** Tailwind's `md`: from here up the scene keeps its grid. */
const DESKTOP = "(min-width: 48rem)";

export type PhoneCarousel = {
  /** Follows the clock while the scene plays. Returns the cleanup. */
  mount(root: HTMLElement, runtime: SceneRuntime): () => void;
  /** Lets the viewer move between developers once the scene has played. */
  explore(): () => void;
};

/**
 * The DOM side of the phone carousel (`PhoneCarousel.tsx`). While the scene
 * plays, the active slide is a pure function of clock time and the reveal
 * times; in explore the buttons, dots, arrow keys and a swipe set it. Off-
 * screen slides are `inert` and `aria-hidden`; from md up nothing is hidden.
 * No timers: it only reacts to clock frames and to events.
 */
export function createPhoneCarousel(): PhoneCarousel {
  let exploring = false;
  let refresh = () => {};

  return {
    mount(root, { clock, reducedMotion }) {
      const carousel = root.querySelector<HTMLElement>("[data-carousel]");
      const track = carousel?.querySelector<HTMLElement>(
        "[data-carousel-track]",
      );
      if (!carousel || !track) return () => {};
      const slides = [
        ...track.querySelectorAll<HTMLElement>(":scope > [data-reveal]"),
      ];
      const times = slides.map((slide) =>
        revealTime(Number(slide.dataset.reveal)),
      );
      const count = slides.length;
      const prev = carousel.querySelector<HTMLButtonElement>(
        "[data-carousel-prev]",
      );
      const next = carousel.querySelector<HTMLButtonElement>(
        "[data-carousel-next]",
      );
      const dots = [
        ...carousel.querySelectorAll<HTMLButtonElement>("[data-carousel-dot]"),
      ];
      const media = window.matchMedia(DESKTOP);
      let index = 0;

      const paint = () => {
        const phone = !media.matches;
        slides.forEach((slide, position) => {
          const offset = slideOffset(position, index);
          slide.style.setProperty("--offset", String(offset));
          slide.style.transition = reducedMotion ? "none" : "";
          const off = phone && offset !== 0;
          slide.toggleAttribute("data-off", off);
          if (off) slide.setAttribute("aria-hidden", "true");
          else slide.removeAttribute("aria-hidden");
          slide.inert = off;
        });
        dots.forEach((dot, position) => {
          dot.toggleAttribute("data-active", position === index);
          dot.disabled = !exploring;
          if (position === index) dot.setAttribute("aria-current", "true");
          else dot.removeAttribute("aria-current");
        });
        if (prev) prev.disabled = !exploring || index === 0;
        if (next) next.disabled = !exploring || index === count - 1;
      };
      refresh = paint;

      const go = (target: number) => {
        if (!exploring) return;
        const clamped = stepIndex(target, 0, count);
        if (clamped === index) return;
        index = clamped;
        interaction.click();
        paint();
      };

      const onClick = (event: Event) => {
        const button = (event.target as Element).closest("button");
        if (!button || !carousel.contains(button)) return;
        if (button === prev) go(index - 1);
        else if (button === next) go(index + 1);
        else if (button.dataset.carouselDot !== undefined) {
          go(Number(button.dataset.carouselDot));
        }
      };
      // The same keys change scene elsewhere; on the controls they step here.
      const onKey = (event: KeyboardEvent) => {
        if (!exploring || !(event.target as Element).closest("button")) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.stopPropagation();
        go(index + (event.key === "ArrowLeft" ? -1 : 1));
      };
      let startX: number | null = null;
      const onDown = (event: PointerEvent) => {
        startX = event.clientX;
      };
      const onUp = (event: PointerEvent) => {
        if (startX === null) return;
        const delta = swipeStep(event.clientX - startX);
        startX = null;
        if (delta !== 0 && !media.matches) go(index + delta);
      };
      const onCancel = () => {
        startX = null;
      };

      carousel.addEventListener("click", onClick);
      carousel.addEventListener("keydown", onKey);
      track.addEventListener("pointerdown", onDown);
      track.addEventListener("pointerup", onUp);
      track.addEventListener("pointercancel", onCancel);
      media.addEventListener("change", paint);

      const render = (seconds: number) => {
        dots.forEach((dot, position) => {
          dot.toggleAttribute("data-pending", seconds < (times[position] ?? 0));
        });
        // After the play, the viewer's choice is not overridden.
        if (!exploring) index = activeAt(seconds, times);
        paint();
      };
      render(0);
      const stop = clock.onFrame(render);

      return () => {
        stop();
        refresh = () => {};
        carousel.removeEventListener("click", onClick);
        carousel.removeEventListener("keydown", onKey);
        track.removeEventListener("pointerdown", onDown);
        track.removeEventListener("pointerup", onUp);
        track.removeEventListener("pointercancel", onCancel);
        media.removeEventListener("change", paint);
        for (const slide of slides) {
          slide.removeAttribute("data-off");
          slide.removeAttribute("aria-hidden");
          slide.inert = false;
          slide.style.removeProperty("--offset");
          slide.style.transition = "";
        }
        for (const dot of dots) {
          dot.removeAttribute("data-pending");
          dot.disabled = true;
        }
        if (prev) prev.disabled = true;
        if (next) next.disabled = true;
      };
    },
    explore() {
      exploring = true;
      refresh();
      return () => {
        exploring = false;
        refresh();
      };
    },
  };
}
