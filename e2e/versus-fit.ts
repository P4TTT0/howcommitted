import { expect, type Locator, type Page } from "@playwright/test";

/** The viewports every scene must fit (width x height). */
export const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

type FitOptions = {
  /** Check that buttons and links are at least `minTarget` px (default true). */
  tapTargets?: boolean;
  minTarget?: number;
  /**
   * Allow an inner area to scroll vertically (never horizontally). Its bottom
   * must still sit above the controls and its last child must be reachable.
   */
  allowVerticalScroll?: boolean;
};

/**
 * Asserts that a scene stays inside its frame. After fonts and two frames
 * settle it checks, for everything visible (not opacity 0, not visibility
 * hidden): the frame is inside the viewport; nothing sticks out sideways or
 * runs under the playback controls; no text overflows its own box (also catches
 * ellipsis and clipping); no child pokes out of a clipping parent; the page has
 * no horizontal scroll; nothing scrolls inside the scene unless allowed (and
 * then it ends above the controls with its last child reachable); every button
 * and link is a comfortable tap target.
 */
export async function expectSceneFits(
  page: Page,
  scene: Locator,
  {
    tapTargets = true,
    minTarget = 44,
    allowVerticalScroll = false,
  }: FitOptions = {},
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const problems = await scene.evaluate(
    (root, options) => {
      const found: string[] = [];
      const width = window.innerWidth;
      const controls = document.querySelector(
        '[aria-label="Playback controls"]',
      );
      const floor = controls
        ? controls.getBoundingClientRect().top
        : window.innerHeight;
      const describe = (element: Element) =>
        `${element.tagName.toLowerCase()} "${(element.textContent ?? "")
          .trim()
          .slice(0, 30)}"`;
      const scrolls = (element: Element) =>
        /(auto|scroll)/.test(getComputedStyle(element).overflowY) &&
        element.scrollHeight > element.clientHeight + 1;
      const hides = (element: Element) => {
        const style = getComputedStyle(element);
        return /(hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`);
      };
      /** Invisible things cannot be clipped or overflow anything. */
      const unseen = (element: Element) => {
        for (
          let node: Element | null = element;
          node && node !== root.parentElement;
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (style.opacity === "0" || style.visibility === "hidden") {
            return true;
          }
        }
        return false;
      };

      const frame = root.getBoundingClientRect();
      // A scrolling scene (the poster) is taller than its frame by design.
      const tall = options.allowVerticalScroll;
      if (
        frame.left < -0.5 ||
        frame.right > width + 0.5 ||
        (!tall && (frame.top < -0.5 || frame.bottom > window.innerHeight + 0.5))
      ) {
        found.push(`the frame leaves the viewport (${JSON.stringify(frame)})`);
      }
      if (document.documentElement.scrollWidth > width) {
        found.push(
          `page scrolls sideways (${document.documentElement.scrollWidth} > ${width})`,
        );
      }

      const inside = [...root.querySelectorAll("*")].filter(
        (element) => !unseen(element),
      );
      const chain: Element[] = [root];
      for (
        let parent: Element | null = root.parentElement;
        parent && parent.tagName !== "MAIN";
        parent = parent.parentElement
      ) {
        chain.push(parent);
      }

      for (const element of [...chain, ...inside]) {
        const rect = element.getBoundingClientRect();
        const tiny = rect.width <= 1 || rect.height <= 1;
        if (scrolls(element) && !tiny) {
          if (!options.allowVerticalScroll) {
            found.push(
              `scrolls inside: ${describe(element)} (${element.scrollHeight} > ${element.clientHeight})`,
            );
          } else {
            if (rect.bottom > floor + 0.5) {
              found.push(
                `a scroller runs under the controls: ${describe(element)}`,
              );
            }
            const kids = [...element.children].filter((kid) => !unseen(kid));
            const last = kids.at(-1);
            if (last) {
              const before = element.scrollTop;
              element.scrollTop = element.scrollHeight;
              if (
                last.getBoundingClientRect().bottom >
                element.getBoundingClientRect().bottom + 1
              ) {
                found.push(`last child unreachable: ${describe(last)}`);
              }
              element.scrollTop = before;
            }
          }
        }
        if (tiny) continue;
        // Text (or anything) wider or taller than its own box, scroller aside.
        if (
          element.scrollWidth > element.clientWidth + 1 &&
          !/(auto|scroll)/.test(getComputedStyle(element).overflowX)
        ) {
          found.push(
            `overflows its box sideways: ${describe(element)} (${element.scrollWidth} > ${element.clientWidth})`,
          );
        }
        if (
          hides(element) &&
          element.scrollHeight > element.clientHeight + 1 &&
          !scrolls(element)
        ) {
          found.push(
            `clips its content: ${describe(element)} (${element.scrollHeight} > ${element.clientHeight})`,
          );
        }
      }

      for (const element of inside) {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) continue;
        if (rect.left < -0.5 || rect.right > width + 0.5) {
          found.push(
            `sticks out sideways: ${describe(element)} (${Math.round(rect.left)}..${Math.round(rect.right)} of ${width})`,
          );
        }
        let scrolled = false;
        for (
          let parent: Element | null = element.parentElement;
          parent && parent !== root.parentElement;
          parent = parent.parentElement
        ) {
          if (scrolls(parent)) scrolled = true;
        }
        if (!scrolled && rect.bottom > floor + 0.5) {
          found.push(
            `runs under the controls: ${describe(element)} (bottom ${Math.round(rect.bottom)} > ${Math.round(floor)})`,
          );
        }
        // A child poking out of a fixed, clipping parent.
        const parent = element.parentElement;
        if (parent && parent !== root.parentElement && hides(parent)) {
          const box = parent.getBoundingClientRect();
          if (
            rect.left < box.left - 1 ||
            rect.right > box.right + 1 ||
            rect.top < box.top - 1 ||
            rect.bottom > box.bottom + 1
          ) {
            found.push(
              `${describe(element)} overflows its parent ${describe(parent)}`,
            );
          }
        }
      }

      if (options.tapTargets) {
        for (const target of inside.filter((element) =>
          element.matches("button, a[href]"),
        )) {
          const rect = target.getBoundingClientRect();
          if (
            rect.height < options.minTarget - 0.5 ||
            rect.width < options.minTarget - 0.5
          ) {
            found.push(
              `small tap target: ${describe(target)} (${Math.round(rect.width)}x${Math.round(rect.height)})`,
            );
          }
        }
      }
      return found;
    },
    { allowVerticalScroll, tapTargets, minTarget },
  );
  expect(problems, problems.join("\n")).toEqual([]);
}
