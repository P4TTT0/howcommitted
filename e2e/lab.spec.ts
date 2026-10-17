import { expect, test } from "@playwright/test";

test("lab renders the start button without producing sound", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute" })).toBeVisible();
});
