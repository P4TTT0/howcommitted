import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const LOGIN = "ada";
const THIS_YEAR = new Date().getFullYear();
/** Several rows, the last one the year still in progress. */
const YEARS = [
  THIS_YEAR - 4,
  THIS_YEAR - 3,
  THIS_YEAR - 2,
  THIS_YEAR - 1,
  THIS_YEAR,
];

async function openExperience(page: Page) {
  const history = makeHistory(
    LOGIN,
    YEARS.map((year) => makeYear(year, steadyDays(year, 3, 2))),
  );
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: LOGIN,
          name: "Ada Lovelace",
          avatarUrl: "",
          createdAt: `${YEARS[0]}-01-01T00:00:00Z`,
          contributionYears: [...YEARS].reverse(),
        },
      },
    }),
  );
  await page.route("**/api/history/*", (route) =>
    route.fulfill({
      json: { source: "cache", reposTruncated: false, history },
    }),
  );
  await page.goto(`/${LOGIN}`);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
}

const progress = (page: Page) =>
  page.getByRole("progressbar", { name: "Playback progress" });

/** Lands on the heatmap already finished (explore), without waiting for it. */
async function openHeatmapInExplore(page: Page) {
  const here = /^Scene \d+ of \d+: Heatmap/;
  for (let step = 0; step < 12; step += 1) {
    const text = (await progress(page).getAttribute("aria-valuetext")) ?? "";
    if (here.test(text)) break;
    await page.getByRole("button", { name: /^Next/ }).click();
  }
  await expect(progress(page)).toHaveAttribute("aria-valuetext", here);
  await page.getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: "Previous scene" }).click();
  await expect(progress(page)).toHaveAttribute("aria-valuetext", here);
  await expect(
    page.getByRole("button", { name: "Replay" }).first(),
  ).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test(`the heatmap fits its frame at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await openExperience(page);
    await openHeatmapInExplore(page);

    await expect(
      page.getByRole("img", { name: /^Contributions per week/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /^Average contributions per month/ }),
    ).toBeVisible();
    await expect(page.getByText(/Each row is a year/)).toHaveCount(0);

    await expectSceneFits(page, { tapTargets: true, allowScroll: true });
  });
}

test("a hovered week shows a tooltip that stays inside the frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openExperience(page);
  await openHeatmapInExplore(page);

  const frame = page.locator("[data-scene-frame]");
  const tip = page.locator("[data-role=tip]");
  const cell = (index: number) => page.locator(`[data-cell="${index}"]`);
  const lastRow = YEARS.length - 1;
  // First row start, first row end and a middle week of the last row.
  const targets = [0, 51, lastRow * 53 + 20];

  for (const index of targets) {
    await cell(index).scrollIntoViewIfNeeded();
    const box = await cell(index).boundingBox();
    if (!box) throw new Error(`cell ${index} has no box`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(tip).toBeVisible();
    await expect(page.locator("[data-role=tip-title]")).toHaveText(
      /^\d[\d,]* contributions?$/,
    );
    await expect(page.locator("[data-role=tip-detail]")).toHaveText(
      /^\d{4} · [A-Z][a-z]{2} \d+ – [A-Z][a-z]{2} \d+$/,
    );
    const frameBox = await frame.boundingBox();
    const tipBox = await tip.boundingBox();
    if (!frameBox || !tipBox) throw new Error("missing boxes");
    expect(tipBox.x).toBeGreaterThanOrEqual(frameBox.x);
    expect(tipBox.y).toBeGreaterThanOrEqual(frameBox.y);
    expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(
      frameBox.x + frameBox.width,
    );
    expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(
      frameBox.y + frameBox.height,
    );
  }

  await page.mouse.move(2, 2);
  await expect(tip).toBeHidden();
});
