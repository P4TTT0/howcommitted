import { expect, type Page } from "@playwright/test";

/**
 * Reusable layout checks for any scene. Every scene must fit its frame with no
 * clipping, no overflow and no horizontal scroll at these sizes (phone, large
 * phone, tablet, laptop, desktop). New scenes adopt `expectSceneFits` as is.
 */
export const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

/** The stage the sequencer gives a scene or the finale (`data-scene-frame`). */
export const FRAME = "[data-scene-frame]";

/** Smallest comfortable tap target, in CSS px. */
export const MIN_TAP = 44;

type Options = {
  /** Selector of the frame; defaults to the sequencer's stage. */
  frame?: string;
  /** Also require every button, link and slider in the frame to be tappable. */
  tapTargets?: boolean;
};

/**
 * Asserts, for what is on screen right now:
 *  - the page has no horizontal scroll;
 *  - nothing in the frame sticks out of it sideways;
 *  - nothing sticks out of it vertically, unless it sits inside a container
 *    that scrolls on purpose (and that container does not scroll sideways);
 *  - no `overflow: hidden` box hides part of its own content (clipped text);
 *  - optionally, every interactive element is at least 44px both ways.
 */
export async function expectSceneFits(page: Page, options: Options = {}) {
  const problems = await page.evaluate(
    ({ frameSelector, tapTargets, minTap }) => {
      const found: string[] = [];
      const frame = document.querySelector(frameSelector);
      if (!frame) return [`no frame matches ${frameSelector}`];
      const box = frame.getBoundingClientRect();
      const doc = document.documentElement;
      if (doc.scrollWidth > doc.clientWidth + 1) {
        found.push(
          `page scrolls sideways (${doc.scrollWidth} > ${doc.clientWidth})`,
        );
      }

      const describe = (element: Element) => {
        const name =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().slice(0, 30) ??
          "";
        const role = element.getAttribute("data-role") ?? "";
        return `<${element.tagName.toLowerCase()}${role ? ` data-role=${role}` : ""}> "${name}"`;
      };
      const round = (n: number) => Math.round(n);

      for (const element of frame.querySelectorAll("*")) {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (element.closest(".sr-only, [hidden]")) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 && rect.height <= 1) continue;

        // A container that scrolls on purpose may hold taller content.
        let scrollsVertically = false;
        for (
          let parent = element.parentElement;
          parent && parent !== frame.parentElement;
          parent = parent.parentElement
        ) {
          const overflowY = getComputedStyle(parent).overflowY;
          if (
            (overflowY === "auto" || overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight + 1
          ) {
            scrollsVertically = true;
            break;
          }
        }

        if (rect.left < box.left - 1 || rect.right > box.right + 1) {
          found.push(
            `${describe(element)} leaves the frame sideways (${round(rect.left)}..${round(rect.right)} vs ${round(box.left)}..${round(box.right)})`,
          );
        }
        if (
          !scrollsVertically &&
          (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)
        ) {
          found.push(
            `${describe(element)} leaves the frame vertically (${round(rect.top)}..${round(rect.bottom)} vs ${round(box.top)}..${round(box.bottom)})`,
          );
        }

        const clips = ["hidden", "clip"];
        if (
          (clips.includes(style.overflowX) ||
            clips.includes(style.overflowY)) &&
          (element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1)
        ) {
          found.push(
            `${describe(element)} clips its content (${element.scrollWidth}x${element.scrollHeight} in ${element.clientWidth}x${element.clientHeight})`,
          );
        }
        if (
          (style.overflowX === "auto" || style.overflowX === "scroll") &&
          element.scrollWidth > element.clientWidth + 1
        ) {
          found.push(`${describe(element)} scrolls sideways`);
        }

        if (
          tapTargets &&
          element.matches(
            'button, a[href], [role="slider"], [role="button"]',
          ) &&
          (rect.width < minTap - 0.5 || rect.height < minTap - 0.5)
        ) {
          found.push(
            `${describe(element)} is a small tap target (${round(rect.width)}x${round(rect.height)})`,
          );
        }
      }
      return found;
    },
    {
      frameSelector: options.frame ?? FRAME,
      tapTargets: options.tapTargets ?? false,
      minTap: MIN_TAP,
    },
  );
  expect(problems, problems.join("\n")).toEqual([]);
}
