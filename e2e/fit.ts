import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Responsive checks for a scene. Local to the versus specs; the API is kept
 * close to the shared helper (`expectSceneFits(page, { ... })`) so the two can
 * be consolidated with a trivial swap.
 */

/** The viewports every scene is checked at. */
export const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

export type FitOptions = {
  /** The scene's labelled content region; its frame is two levels up. */
  region: Locator;
  /** Check that every button is at least `minTargetPx` (default on). */
  tapTargets?: boolean;
  /** A phone may scroll the scene vertically; larger screens should not. */
  allowVerticalScroll?: boolean;
  /** Smallest text the scene may use, in CSS px. */
  minFontPx?: number;
  minTargetPx?: number;
};

/**
 * Asserts that a scene stays inside its frame: nothing sticks out of the
 * frame, the viewport or its own parent box, no text overflows a fixed box, no
 * horizontal scroll anywhere, nothing is cut off at the bottom, a scroller (if
 * allowed) ends above the controls with its last child reachable, text stays
 * legible and every button is a real tap target. Fonts are loaded and two
 * frames have painted before anything is measured.
 */
export async function expectSceneFits(
  page: Page,
  options: FitOptions,
): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const problems = await options.region.evaluate(
    (element, settings) => {
      const found: string[] = [];
      const frame = element.parentElement?.parentElement;
      if (!frame) return ["scene frame not found"];
      const tolerance = 1;
      const box = frame.getBoundingClientRect();
      const doc = document.documentElement;
      const controls = document.querySelector(
        '[aria-label="Playback controls"]',
      );
      const controlsTop = controls
        ? controls.getBoundingClientRect().top
        : window.innerHeight;

      if (doc.scrollWidth > doc.clientWidth + tolerance) {
        found.push(
          `page scrolls horizontally (${doc.scrollWidth} > ${doc.clientWidth})`,
        );
      }
      if (
        box.left < -tolerance ||
        box.right > doc.clientWidth + tolerance ||
        box.top < -tolerance ||
        box.bottom > window.innerHeight + tolerance
      ) {
        found.push("frame is not inside the viewport");
      }
      if (box.bottom > controlsTop + tolerance) {
        found.push("frame runs under the controls");
      }
      if (element.scrollWidth > element.clientWidth + tolerance) {
        found.push(
          `region scrolls horizontally (${element.scrollWidth} > ${element.clientWidth})`,
        );
      }

      const overflowsY =
        element.scrollHeight > element.clientHeight + tolerance;
      if (overflowsY) {
        if (!settings.allowVerticalScroll) {
          found.push(
            `region needs vertical scroll (${element.scrollHeight} > ${element.clientHeight})`,
          );
        } else {
          const region = element.getBoundingClientRect();
          if (region.bottom > controlsTop + tolerance) {
            found.push("scroller ends under the controls");
          }
          // The last child must be reachable by scrolling.
          const last = element.lastElementChild;
          if (last) {
            const before = element.scrollTop;
            element.scrollTop = element.scrollHeight;
            const lastBox = last.getBoundingClientRect();
            if (lastBox.bottom > region.bottom + tolerance) {
              found.push("last child is not reachable by scrolling");
            }
            element.scrollTop = before;
          }
        }
      }

      const hiddenOrClear = (node: Element) => {
        for (
          let n: Element | null = node;
          n && n !== frame;
          n = n.parentElement
        ) {
          const style = getComputedStyle(n);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number.parseFloat(style.opacity) === 0
          ) {
            return true;
          }
        }
        return node.getClientRects().length === 0;
      };
      const isScroller = (node: Element) => {
        const { overflowX, overflowY } = getComputedStyle(node);
        return /(auto|scroll|hidden|clip)/.test(`${overflowX} ${overflowY}`);
      };
      const insideScroller = (node: Element) => {
        for (
          let parent = node.parentElement;
          parent && parent !== frame;
          parent = parent.parentElement
        ) {
          const { overflowY } = getComputedStyle(parent);
          if (
            (overflowY === "auto" || overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight + tolerance
          ) {
            return true;
          }
        }
        return false;
      };
      const name = (node: Element) =>
        `${node.tagName.toLowerCase()}${
          node.getAttribute("data-role")
            ? `[${node.getAttribute("data-role")}]`
            : ""
        } "${(node.textContent ?? "").trim().slice(0, 24)}"`;

      for (const node of frame.querySelectorAll("*")) {
        if (hiddenOrClear(node)) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const style = getComputedStyle(node);

        if (rect.left < box.left - tolerance) {
          found.push(`${name(node)} sticks out on the left`);
        }
        if (rect.right > box.right + tolerance) {
          found.push(`${name(node)} sticks out on the right`);
        }
        if (
          rect.bottom > box.bottom + tolerance &&
          !insideScroller(node) &&
          !settings.allowVerticalScroll
        ) {
          found.push(`${name(node)} sticks out at the bottom`);
        }

        // A box never holds something wider than itself.
        const parent = node.parentElement;
        if (
          parent &&
          parent !== frame &&
          style.position !== "absolute" &&
          style.position !== "fixed"
        ) {
          const outer = parent.getBoundingClientRect();
          if (
            rect.right > outer.right + tolerance ||
            rect.left < outer.left - tolerance
          ) {
            found.push(`${name(node)} spills out of ${name(parent)}`);
          }
        }

        // Text running past its own box (deliberate ellipsis and scrollers excepted).
        if (
          node.scrollWidth > node.clientWidth + tolerance &&
          node.clientWidth > 0 &&
          style.textOverflow !== "ellipsis" &&
          !isScroller(node) &&
          node !== element
        ) {
          found.push(
            `${name(node)} overflows its box (${node.scrollWidth} > ${node.clientWidth})`,
          );
        }

        const hasText = [...node.childNodes].some(
          (child) =>
            child.nodeType === Node.TEXT_NODE &&
            (child.textContent ?? "").trim() !== "",
        );
        if (hasText) {
          const size = Number.parseFloat(style.fontSize);
          if (size < settings.minFontPx) {
            found.push(`${name(node)} text is ${size}px`);
          }
        }
        if (settings.tapTargets && node.tagName === "BUTTON") {
          if (
            rect.width < settings.minTargetPx - 0.5 ||
            rect.height < settings.minTargetPx - 0.5
          ) {
            found.push(
              `${name(node)} is ${Math.round(rect.width)}x${Math.round(rect.height)}`,
            );
          }
        }
      }
      return found;
    },
    {
      allowVerticalScroll: options.allowVerticalScroll ?? false,
      tapTargets: options.tapTargets ?? true,
      minFontPx: options.minFontPx ?? 11,
      minTargetPx: options.minTargetPx ?? 44,
    },
  );
  expect(problems, problems.join("\n")).toEqual([]);
}
