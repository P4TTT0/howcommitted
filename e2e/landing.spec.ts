import { expect, test } from "@playwright/test";

test("landing page renders the Committed heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Committed" }),
  ).toBeVisible();
});
