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
 * Asserts, for what is on screen right now (after fonts and layout settle):
 *  - the frame sits inside the viewport and the page has no horizontal scroll;
 *  - nothing in the frame sticks out of it sideways;
 *  - nothing sticks out of it vertically, unless it sits inside a container
 *    that scrolls on purpose, whose bottom edge is inside the frame, and whose
 *    last child can be scrolled into view and fits;
 *  - no element holds more content than its box shows (clipped or spilling
 *    text), and no child spills out of its own parent, unless that parent is a
 *    deliberate scroller on that axis;
 *  - optionally, every interactive element is at least 44px both ways.
 * Invisible elements (display none, visibility hidden, opacity 0) are skipped.
 */
export async function expectSceneFits(page: Page, options: Options = {}) {
  // Measure the settled layout: web fonts change text widths.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  const problems = await page.evaluate(
    ({ frameSelector, tapTargets, minTap }) => {
      const found: string[] = [];
      const frame = document.querySelector(frameSelector);
      if (!frame) return [`no frame matches ${frameSelector}`];
      const box = frame.getBoundingClientRect();
      const doc = document.documentElement;
      const round = (n: number) => Math.round(n);

      if (doc.scrollWidth > doc.clientWidth + 1) {
        found.push(
          `page scrolls sideways (${doc.scrollWidth} > ${doc.clientWidth})`,
        );
      }
      if (
        box.left < -1 ||
        box.top < -1 ||
        box.right > window.innerWidth + 1 ||
        box.bottom > window.innerHeight + 1
      ) {
        found.push(
          `the frame leaves the viewport (${round(box.left)},${round(box.top)} to ${round(box.right)},${round(box.bottom)} in ${window.innerWidth}x${window.innerHeight})`,
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
      const scrolls = (style: CSSStyleDeclaration, axis: "x" | "y") => {
        const value = axis === "x" ? style.overflowX : style.overflowY;
        return value === "auto" || value === "scroll";
      };
      const invisible = (element: Element) => {
        for (
          let node: Element | null = element;
          node && node !== frame.parentElement;
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          ) {
            return true;
          }
        }
        return false;
      };

      const everything = [frame, ...frame.querySelectorAll("*")];
      const scrollers: Element[] = [];

      for (const element of everything) {
        if (invisible(element) || element.closest(".sr-only, [hidden]")) {
          continue;
        }
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 && rect.height <= 1) continue;
        const isFrame = element === frame;
        // A line break has a box but no content of its own.
        if (element.tagName === "BR") continue;

        // A container that scrolls on purpose may hold taller content.
        let exempt: Element | null = null;
        for (
          let parent = element.parentElement;
          parent && parent !== frame.parentElement;
          parent = parent.parentElement
        ) {
          if (
            scrolls(getComputedStyle(parent), "y") &&
            parent.scrollHeight > parent.clientHeight + 1
          ) {
            exempt = parent;
            break;
          }
        }
        if (exempt && !scrollers.includes(exempt)) scrollers.push(exempt);

        if (!isFrame) {
          if (rect.left < box.left - 1 || rect.right > box.right + 1) {
            found.push(
              `${describe(element)} leaves the frame sideways (${round(rect.left)}..${round(rect.right)} vs ${round(box.left)}..${round(box.right)})`,
            );
          }
          if (
            !exempt &&
            (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)
          ) {
            found.push(
              `${describe(element)} leaves the frame vertically (${round(rect.top)}..${round(rect.bottom)} vs ${round(box.top)}..${round(box.bottom)})`,
            );
          }
        }

        // Holds more than it shows: clipped, or spilling out of its own box.
        if (
          !scrolls(style, "x") &&
          element.scrollWidth > element.clientWidth + 1 &&
          element.clientWidth > 0
        ) {
          found.push(
            `${describe(element)} has content wider than its box (${element.scrollWidth} > ${element.clientWidth})`,
          );
        }
        // Giant type with a tight line-height has a glyph box taller than its
        // line box without hiding anything, so only boxes that really clip are
        // checked here; content spilling out of a box is caught by the parent
        // check below.
        const clipsY =
          style.overflowY === "hidden" || style.overflowY === "clip";
        if (
          clipsY &&
          !scrolls(style, "y") &&
          element.scrollHeight > element.clientHeight + 1 &&
          element.clientHeight > 0
        ) {
          found.push(
            `${describe(element)} has content taller than its box (${element.scrollHeight} > ${element.clientHeight})`,
          );
        }

        // A child must stay inside its own parent.
        const parent = element.parentElement;
        if (
          !isFrame &&
          parent &&
          style.position !== "absolute" &&
          style.position !== "fixed"
        ) {
          const parentStyle = getComputedStyle(parent);
          const parentRect = parent.getBoundingClientRect();
          if (
            !scrolls(parentStyle, "x") &&
            (rect.left < parentRect.left - 1 ||
              rect.right > parentRect.right + 1)
          ) {
            found.push(
              `${describe(element)} spills out of its parent sideways (${round(rect.left)}..${round(rect.right)} vs ${round(parentRect.left)}..${round(parentRect.right)})`,
            );
          }
          if (
            !scrolls(parentStyle, "y") &&
            (rect.top < parentRect.top - 1 ||
              rect.bottom > parentRect.bottom + 1)
          ) {
            found.push(
              `${describe(element)} spills out of its parent vertically (${round(rect.top)}..${round(rect.bottom)} vs ${round(parentRect.top)}..${round(parentRect.bottom)})`,
            );
          }
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

      // Deliberate scrollers: the bottom edge must be on screen, and scrolling
      // to the end must bring the last child fully into view.
      for (const scroller of scrollers) {
        const rect = scroller.getBoundingClientRect();
        if (rect.bottom > box.bottom + 1) {
          found.push(
            `${describe(scroller)} scrolls but its bottom edge is outside the frame (${round(rect.bottom)} > ${round(box.bottom)})`,
          );
          continue;
        }
        const last = [...scroller.children]
          .filter((child) => !invisible(child))
          .at(-1);
        if (!last) continue;
        const before = scroller.scrollTop;
        scroller.scrollTop = scroller.scrollHeight;
        const lastRect = last.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        if (lastRect.bottom > scrollerRect.bottom + 1) {
          found.push(
            `${describe(scroller)} cannot scroll its last child into view (${round(lastRect.bottom)} > ${round(scrollerRect.bottom)})`,
          );
        }
        if (lastRect.left < box.left - 1 || lastRect.right > box.right + 1) {
          found.push(
            `${describe(last)} (last child) leaves the frame sideways`,
          );
        }
        scroller.scrollTop = before;
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
