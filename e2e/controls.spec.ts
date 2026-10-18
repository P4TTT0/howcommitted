import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";

const AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='%23141414'/></svg>";

const history = makeHistory("ada", [
  makeYear(2022, steadyDays(2022, 2)),
  makeYear(2023, steadyDays(2023, 3)),
  makeYear(2024, steadyDays(2024, 2)),
]);
const historyBody = { source: "cache", reposTruncated: false, history };

/** Mocks the two API routes; everything is `ada`. */
async function mockApi(page: Page) {
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: "ada",
          name: "Ada Lovelace",
          avatarUrl: AVATAR,
          createdAt: "2022-01-01T00:00:00Z",
          contributionYears: [2024, 2023, 2022],
        },
      },
    }),
  );
  await page.route("**/api/history/*", (route) =>
    route.fulfill({ status: 200, json: historyBody }),
  );
}

const playButton = (page: Page) =>
  page.getByRole("button", { name: "Play", exact: true });
const pauseButton = (page: Page) => page.getByRole("button", { name: "Pause" });
const replayButton = (page: Page) =>
  page.getByRole("button", { name: "Replay" });
const nextButton = (page: Page) => page.getByRole("button", { name: /^Next/ });
const prevButton = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });
const cancelButton = (page: Page) =>
  page.getByRole("button", { name: "Cancel and go back" });
/** How many scenes this fixture plays: one tick per scene on the bar. */
const sceneCount = (page: Page) => page.locator("[data-scene-tick]").count();
const progress = (page: Page) =>
  page.getByRole("progressbar", { name: "Playback progress" });

/** A shared-link visit, played from the start button. */
async function play(page: Page) {
  await mockApi(page);
  await page.goto("/ada");
  await playButton(page).click();
  await expect(pauseButton(page)).toBeEnabled();
}

/**
 * Lands on a scene in explore without waiting for it to play: leaving a scene
 * counts it as played, so stepping forward and back reopens it finished.
 */
async function openInExplore(page: Page, sceneNumber: number) {
  for (let scene = 1; scene <= sceneNumber; scene += 1) {
    await nextButton(page).click();
  }
  await prevButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene ${sceneNumber} of`),
  );
  await expect(replayButton(page)).toBeVisible();
}

test("a finished scene holds in explore and never moves on by itself", async ({
  page,
}) => {
  // The timeline draws for about half a minute; its end turns Pause into Replay.
  test.setTimeout(90_000);
  await play(page);

  await expect(replayButton(page)).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1500);
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    `Scene 1 of ${await sceneCount(page)}: Timeline`,
  );
  // The way forward is there, never a dead end.
  await expect(nextButton(page)).toBeEnabled();

  await nextButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    `Scene 2 of ${await sceneCount(page)}: Heatmap`,
  );
  await expect(pauseButton(page)).toBeVisible();
});

test("previous, next and the scene segments move at any time", async ({
  page,
}) => {
  await play(page);
  await expect(prevButton(page)).toBeDisabled();

  // A scene never played plays.
  await page.getByRole("button", { name: /^Go to scene 2/ }).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene 2 of ${await sceneCount(page)}\\b`),
  );
  await expect(pauseButton(page)).toBeVisible();

  // Going back lands on the finished scene, ready to replay.
  await prevButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene 1 of ${await sceneCount(page)}\\b`),
  );
  await expect(replayButton(page)).toBeVisible();

  // So does a jump to a scene that was left.
  await page.getByRole("button", { name: /^Go to scene 2/ }).click();
  await expect(replayButton(page)).toBeVisible();

  // The finale is reachable with Next and leads back with Previous.
  const scenes = await page.locator("[data-scene-tick]").count();
  for (let scene = 2; scene <= scenes; scene++) {
    await nextButton(page).click();
  }
  await expect(
    page.getByText("Contributions are not productivity."),
  ).toBeVisible();
  await expect(nextButton(page)).toBeDisabled();
  await prevButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene ${scenes} of ${scenes}`),
  );
  await expect(replayButton(page)).toBeVisible();
});

test("the timeline reads each year by pointer and keyboard in explore", async ({
  page,
}) => {
  await play(page);
  await openInExplore(page, 1);

  const chart = page.getByRole("slider", { name: "Contributions by year" });
  await expect(chart).toBeVisible();
  const [first, second, third] = history.years;
  if (!first || !second || !third) throw new Error("Fixture needs 3 years");
  const reading = (
    year: (typeof history.years)[number],
    thisYear: number,
    total: number,
  ) =>
    `${year.year}: ${thisYear.toLocaleString("en-US")} contributions this year, ${total.toLocaleString("en-US")} in total`;
  const afterSecond = first.totalContributions + second.totalContributions;

  await chart.focus();
  await expect(chart).toHaveAttribute(
    "aria-valuetext",
    reading(third, third.totalContributions, history.totalContributions),
  );
  await chart.press("ArrowLeft");
  await expect(chart).toHaveAttribute(
    "aria-valuetext",
    reading(second, second.totalContributions, afterSecond),
  );
  // The arrows belong to the chart while it is focused: still the same scene.
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene 1 of ${await sceneCount(page)}\\b`),
  );

  const box = await chart.boundingBox();
  if (!box) throw new Error("The chart has no box");
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  await expect(chart).toHaveAttribute(
    "aria-valuetext",
    reading(first, first.totalContributions, first.totalContributions),
  );
  await expect(page.locator("[data-readout-year]")).toHaveText(
    String(first.year),
  );
  await expect(page.locator("[data-readout-detail]")).toHaveText(
    `${first.totalContributions.toLocaleString("en-US")} this year · ${first.totalContributions.toLocaleString("en-US")} total`,
  );
});

test("the heatmap reads a week by keyboard and shows the month strip", async ({
  page,
}) => {
  await play(page);
  await openInExplore(page, 2);

  const grid = page.getByRole("slider", { name: "Contributions by week" });
  await expect(grid).toBeVisible();
  await grid.focus();
  await expect(grid).toHaveAttribute(
    "aria-valuetext",
    /^2024 · week \d+: \d+ contributions? that week$/,
  );
  await grid.press("Home");
  await expect(grid).toHaveAttribute(
    "aria-valuetext",
    /^2022 · week 1: \d+ contributions? that week$/,
  );
  await grid.press("ArrowDown");
  await expect(grid).toHaveAttribute(
    "aria-valuetext",
    /^2023 · week 1: \d+ contributions? that week$/,
  );
  // The arrows belong to the grid while it is focused: still the same scene.
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene 2 of ${await sceneCount(page)}\\b`),
  );
  await expect(page.locator("[data-role=readout-title]")).toHaveText(
    "2023 · week 1",
  );

  // The fixture lives through every calendar month, so the strip is shown.
  await expect(
    page.getByRole("img", { name: /^Average contributions per month/ }),
  ).toBeVisible();
});

test("speed is chosen once and carries across scenes", async ({ page }) => {
  await play(page);

  const speed = page.getByRole("button", { name: /^Playback speed/ });
  // The button cycles 1× → 1.5× → 2× → 0.5×.
  for (let press = 0; press < 3; press += 1) await speed.click();
  await expect(speed).toHaveText("0.5×");
  // At half speed the 4 second scene is still running well past 4 seconds.
  await page.waitForTimeout(5000);
  await expect(pauseButton(page)).toBeVisible();

  await nextButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene 2 of ${await sceneCount(page)}\\b`),
  );
  await expect(speed).toHaveText("0.5×");
  expect(
    await page.evaluate(() => sessionStorage.getItem("committed:speed")),
  ).toBe("0.5");
});

test("keyboard shortcuts steer the experience", async ({ page }) => {
  await play(page);

  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(pauseButton(page)).toBeVisible();

  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene 2 of ${await sceneCount(page)}\\b`),
  );
  await page.keyboard.press("ArrowLeft");
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Scene 1 of ${await sceneCount(page)}\\b`),
  );
  await expect(replayButton(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
});

test("cancel returns to the landing with the search prefilled", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await page
    .getByRole("button", { name: /^Play( @\w+)?$/ })
    .first()
    .click();
  await expect(pauseButton(page)).toBeEnabled();

  await cancelButton(page).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("GitHub username")).toHaveValue("ada");
});

test("cancel on a shared-link visit goes to the landing", async ({ page }) => {
  await play(page);
  await cancelButton(page).click();
  await expect(page).toHaveURL(/\/$/);
});

test("cancelling while the history loads aborts the request", async ({
  page,
}) => {
  await page.route("**/api/history/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    await route.fulfill({ status: 200, json: historyBody }).catch(() => {});
  });
  await page.goto("/ada");
  await playButton(page).click();
  const aborted = page.waitForEvent("requestfailed", (request) =>
    request.url().includes("/api/history/"),
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await aborted;
  await expect(page).toHaveURL(/\/$/);
});
