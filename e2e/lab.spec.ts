import { expect, test } from "@playwright/test";

test("lab renders the start button without producing sound", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(
    page.getByRole("button", { name: "How Committed?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute" })).toBeVisible();
  const kit = page.getByRole("combobox", { name: "Sound kit" });
  await expect(kit).toBeVisible();
  await expect(kit).toHaveValue("bubble");
});
