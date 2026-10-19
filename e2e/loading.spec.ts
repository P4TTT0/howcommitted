import { expect, type Page, test } from "@playwright/test";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='%23141414'/></svg>";

/** The longest login GitHub allows: 39 characters. */
const LONG_LOGIN = "abcdefghij-abcdefghij-abcdefghij-abcdef";

/** Opens the experience and leaves the history request hanging. */
async function openLoading(page: Page, login: string) {
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login,
          name: null,
          avatarUrl: AVATAR,
          createdAt: "2016-01-01T00:00:00Z",
          contributionYears: [2024],
        },
      },
    }),
  );
  await page.route("**/api/history/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.abort().catch(() => {});
  });
  await page.goto(`/${login}`);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByText("Cancel", { exact: true })).toBeVisible();
}

test("the loading screen shows a rising percentage and a phrase", async ({
  page,
}) => {
  await openLoading(page, "ada");
  const phrase = page.locator("[data-loading-frame] [aria-live=polite]");
  await expect(phrase).toHaveText(/\S/);
  await expect(page.getByText("Loaded", { exact: true })).toBeVisible();
  const first = await page
    .locator("[data-loading-frame] p.font-display")
    .first();
  await expect(first).toContainText("%");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
});

for (const viewport of VIEWPORTS) {
  test(`the loading screen fits with a 39-character login at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await openLoading(page, LONG_LOGIN);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `@${LONG_LOGIN}`,
    );
    await expectSceneFits(page, {
      frame: "[data-loading-frame]",
      tapTargets: true,
      allowScroll: false,
    });
  });
}
