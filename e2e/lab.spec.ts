import { expect, test } from "@playwright/test";

test("lab renders the start button without producing sound", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute" })).toBeVisible();
});

test("lab previews one scene on its own with ?scene=", async ({ page }) => {
  await page.goto("/lab?scene=year-blocks");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("progressbar", { name: "Playback progress" }),
  ).toHaveAttribute("aria-valuetext", "Scene 1 of 1: Year blocks");
  await expect(
    page.getByRole("img", { name: /^Contributions per year: 2018 / }),
  ).toBeVisible();
});

test("lab shows the whole controls bar, idle before Play and live after", async ({
  page,
}) => {
  await page.goto("/lab?scene=year-blocks");
  const speeds = page.getByRole("group", { name: "Playback speed" });
  await expect(speeds.getByRole("button")).toHaveText([
    "0.5×",
    "1×",
    "1.5×",
    "2×",
  ]);
  await expect(speeds.getByRole("button", { name: "1×" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Pause" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Cancel and go back" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Previous scene" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("Contributions are not productivity."),
  ).toBeVisible();
});
