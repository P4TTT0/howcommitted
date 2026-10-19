import { expect, type Page, test } from "@playwright/test";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

/** The longest login GitHub allows: 39 characters. */
const LONG = (letter: string) => `${letter.repeat(19)}-${letter.repeat(19)}`;

/** Opens a versus lineup and leaves every history request hanging. */
async function openLoading(page: Page, logins: string[]) {
  await page.route("**/api/history/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.abort().catch(() => {});
  });
  await page.goto(`/${logins.join("/")}`);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(
    page.locator("[data-loading-frame]").getByRole("button", {
      name: "Cancel",
      exact: true,
    }),
  ).toBeVisible();
}

test("the versus loading screen lists every login with a percentage", async ({
  page,
}) => {
  await openLoading(page, ["ada", "grace", "linus"]);
  const frame = page.locator("[data-loading-frame]");
  for (const login of ["ada", "grace", "linus"]) {
    await expect(frame.getByText(`@${login}`).first()).toBeAttached();
  }
  await expect(frame.getByText("Loaded", { exact: true })).toBeVisible();
  await expect(frame).toContainText("1 of 3");
});

test("cancel on the versus loading screen goes back to the landing", async ({
  page,
}) => {
  await openLoading(page, ["ada", "grace"]);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const viewport of VIEWPORTS) {
  for (const [count, logins] of [
    [2, [LONG("a"), LONG("b")]],
    [5, [LONG("a"), LONG("b"), LONG("c"), LONG("d"), LONG("e")]],
  ] as const) {
    test(`the versus loading screen fits ${count} developers with 39-character logins at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await openLoading(page, [...logins]);
      await expectSceneFits(page, {
        frame: "[data-loading-frame]",
        tapTargets: true,
        allowScroll: false,
      });
    });
  }
}
