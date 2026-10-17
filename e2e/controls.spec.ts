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
const TOTAL = history.totalContributions.toLocaleString("en-US");

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
const nextButton = (page: Page) =>
  page.getByRole("button", { name: "Next", exact: true });
const prevButton = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });
const cancelButton = (page: Page) =>
  page.getByRole("button", { name: "Cancel and go back" });
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
  await play(page);

  // The first scene is a few seconds long; its end turns Pause into Replay.
  await expect(replayButton(page)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    "Scene 1 of 2: Year blocks",
  );
  // The way forward is there, never a dead end.
  await expect(nextButton(page)).toBeEnabled();

  await nextButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    "Scene 2 of 2: Cumulative line",
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
    /^Scene 2 of 2/,
  );
  await expect(pauseButton(page)).toBeVisible();

  // Going back lands on the finished scene, ready to replay.
  await prevButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /^Scene 1 of 2/,
  );
  await expect(replayButton(page)).toBeVisible();

  // So does a jump to a scene that was left.
  await page.getByRole("button", { name: /^Go to scene 2/ }).click();
  await expect(replayButton(page)).toBeVisible();

  // The finale is reachable with Next and leads back with Previous.
  await nextButton(page).click();
  await expect(
    page.getByText("Contributions are not productivity."),
  ).toBeVisible();
  await expect(nextButton(page)).toBeDisabled();
  await prevButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /^Scene 2 of 2/,
  );
  await expect(replayButton(page)).toBeVisible();
});

test("year blocks can be read by pointer and keyboard in explore", async ({
  page,
}) => {
  await play(page);
  await openInExplore(page, 1);

  const chart = page.getByRole("slider", { name: "Contributions by year" });
  await expect(chart).toBeVisible();
  const [first, second, third] = history.years;
  if (!first || !second || !third) throw new Error("Fixture needs 3 years");
  const reading = (year: (typeof history.years)[number]) =>
    `${year.year}: ${year.totalContributions.toLocaleString("en-US")} contributions`;

  await chart.focus();
  await expect(chart).toHaveAttribute("aria-valuetext", reading(third));
  await chart.press("ArrowLeft");
  await expect(chart).toHaveAttribute("aria-valuetext", reading(second));
  // The arrows belong to the chart while it is focused: still the same scene.
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /^Scene 1 of 2/,
  );

  const box = await chart.boundingBox();
  if (!box) throw new Error("The chart has no box");
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  await expect(chart).toHaveAttribute("aria-valuetext", reading(first));
  await expect(page.locator('[data-role="year"]')).toHaveText(
    String(first.year),
  );
  await expect(page.locator('[data-role="value"]')).toHaveText(
    first.totalContributions.toLocaleString("en-US"),
  );
});

test("the cumulative line reads the date and total under the pointer", async ({
  page,
}) => {
  await play(page);
  await openInExplore(page, 2);

  const chart = page.getByRole("slider", {
    name: "Cumulative contributions by date",
  });
  const box = await chart.boundingBox();
  if (!box) throw new Error("The chart has no box");
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
  await expect(chart).toHaveAttribute(
    "aria-valuetext",
    new RegExp(`^Dec \\d+, 2024: ${TOTAL} contributions so far`),
  );
  await expect(page.getByText(`${TOTAL} contributions so far`)).toBeVisible();

  await chart.focus();
  await chart.press("Home");
  await expect(chart).toHaveAttribute(
    "aria-valuetext",
    /^Jan 1, 2022: \d+ contributions so far/,
  );
});

test("speed is chosen once and carries across scenes", async ({ page }) => {
  await play(page);

  const slow = page.getByRole("button", { name: "0.5×" });
  await slow.click();
  await expect(slow).toHaveAttribute("aria-pressed", "true");
  // At half speed the 4 second scene is still running well past 4 seconds.
  await page.waitForTimeout(5000);
  await expect(pauseButton(page)).toBeVisible();

  await nextButton(page).click();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /^Scene 2 of 2/,
  );
  await expect(slow).toHaveAttribute("aria-pressed", "true");
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
  await expect(page.getByRole("button", { name: "Mute" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("ArrowRight");
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /^Scene 2 of 2/,
  );
  await page.keyboard.press("ArrowLeft");
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /^Scene 1 of 2/,
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
