import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, FRAME, VIEWPORTS } from "./support/fit";

const play = (page: Page) => page.getByRole("button", { name: "Play" });
const nextButton = (page: Page) => page.getByRole("button", { name: /^Next/ });
const prevButton = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });

/** [year, contributions per active day, an active day every N days] */
type Shape = [number, number, number];

const LONG_A = "ab".repeat(20).slice(0, 39);
const LONG_B = "cd".repeat(20).slice(0, 39);

const SCENARIOS = [
  { name: "three developers", logins: ["ada", "grace", "linus"] },
  {
    name: "five developers",
    logins: ["ada", "grace", "linus", "margaret", "veteran"],
  },
  { name: "39-character logins", logins: [LONG_A, LONG_B] },
];

/** Every login gets 2023 and 2024, each on a different rhythm. */
async function mockHistory(page: Page, logins: string[]) {
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    const every = 2 + (logins.indexOf(login) % 3);
    const shapes: Shape[] = [
      [2023, 3, every],
      [2024, 3, every],
    ];
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: makeHistory(
          login,
          shapes.map(([year, count, step]) =>
            makeYear(year, steadyDays(year, count, step)),
          ),
        ),
      },
    });
  });
}

/** Plays to the end, then walks back to the shared days, finished (explore). */
async function openSharedDays(page: Page, logins: string[]) {
  await mockHistory(page, logins);
  await page.goto(`/${logins.join("/")}`);
  await play(page).click();
  await expect(nextButton(page)).toBeEnabled();
  while (await nextButton(page).isEnabled()) await nextButton(page).click();
  const shared = page.getByRole("region", { name: /^Shared days/ });
  for (let back = 0; back < 8 && !(await shared.isVisible()); back += 1) {
    await prevButton(page).click();
    await page.waitForTimeout(150);
  }
  await expect(shared).toBeVisible();
  return shared;
}

for (const scenario of SCENARIOS) {
  for (const viewport of VIEWPORTS) {
    test(`shared days fit at ${viewport.name}: ${scenario.name}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const shared = await openSharedDays(page, scenario.logins);
      const phone = viewport.width < 768;
      const options = { tapTargets: true, allowScroll: phone };

      await expectSceneFits(page, options);
      await page.getByRole("button", { name: "Earlier year" }).click();
      await expectSceneFits(page, options);

      // The tooltip of a corner day stays inside the frame.
      const grid = shared.getByRole("slider", { name: /Days of the year/ });
      await grid.focus();
      for (const key of ["Home", "End"]) {
        await grid.press(key);
        const tip = shared.getByRole("tooltip");
        await expect(tip).toBeVisible();
        await expectSceneFits(page, options);
        const frame = await page.locator(FRAME).boundingBox();
        const box = await tip.boundingBox();
        if (!frame || !box) throw new Error("no boxes");
        expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
        expect(box.y).toBeGreaterThanOrEqual(frame.y - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(
          frame.x + frame.width + 1,
        );
        expect(box.y + box.height).toBeLessThanOrEqual(
          frame.y + frame.height + 1,
        );
      }
    });
  }
}

test("a hovered day shows who contributed and the stepper changes the year", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shared = await openSharedDays(page, ["ada", "grace", "linus"]);

  await expect(shared.getByText(/Each square is a day/)).toHaveCount(0);
  await expect(shared.getByRole("button", { name: /^20\d\d$/ })).toHaveCount(0);

  const days = shared.locator('[data-role="grid-weeks"] [data-slot]');
  await days.nth(10).hover();
  const tip = shared.getByRole("tooltip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(/[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+/);
  await expect(tip).toContainText(/@\w+|Nobody that day/);

  await page.mouse.move(2, 2);
  await expect(tip).toBeHidden();

  const year = page.locator('[data-role="year-current"]');
  const before = await year.textContent();
  await page.getByRole("button", { name: "Earlier year" }).click();
  await expect(year).not.toHaveText(before ?? "");
  await expect(page.getByRole("button", { name: "Later year" })).toBeEnabled();
});

test("a tap on a day shows the tooltip on a phone", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const shared = await openSharedDays(page, ["ada", "grace"]);
  const day = shared.locator('[data-role="grid-months"] [data-slot]').nth(10);
  await day.scrollIntoViewIfNeeded();
  await day.tap();
  await expect(shared.getByRole("tooltip")).toBeVisible();
  await context.close();
});
