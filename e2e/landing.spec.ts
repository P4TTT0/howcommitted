import { expect, test } from "@playwright/test";

const AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='%23141414'/></svg>";

const preview = {
  user: {
    login: "ada",
    name: "Ada Lovelace",
    avatarUrl: AVATAR,
    createdAt: "2022-01-01T00:00:00Z",
    contributionYears: [2024, 2023, 2022],
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/user/*", (route) =>
    route.fulfill({ json: preview }),
  );
  await page.route("**/api/history/*", (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
});

test("the landing is the question, with the input inside the sentence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("How committed", { exact: true })).toBeVisible();
  const input = page.getByRole("textbox", {
    name: "How committed is GitHub username",
  });
  await expect(input).toBeVisible();
  // The wordmark is small; the question is the headline, not a second title.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
});

test("typing a username finds the user in a clickable row", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  const row = page.getByRole("button", { name: /Ada Lovelace/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("@ada · Active 2022–2024");
  await expect(row).toHaveCSS("cursor", "pointer");
});

test("the whole preview row starts the experience", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  await page.getByRole("button", { name: /Ada Lovelace/ }).click();
  await expect(page).toHaveURL(/\/ada$/);
});

test("Listen has a pointer, and Enter starts when a user is found", async ({
  page,
}) => {
  await page.goto("/");
  const listen = page.getByRole("button", { name: "Listen", exact: true });
  await expect(listen).toHaveAttribute("aria-disabled", "true");

  const input = page.getByLabel("GitHub username");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Type a GitHub username first.")).toBeVisible();

  await input.fill("ada");
  await expect(listen).toHaveAttribute("aria-disabled", "false");
  await expect(listen).toHaveCSS("cursor", "pointer");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/ada$/);
});

test("the nav credits the author and links out", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "About" });
  await expect(nav.getByRole("link", { name: "@P4TTT0" })).toHaveAttribute(
    "href",
    "https://github.com/P4TTT0",
  );
  await expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/P4TTT0/howcommitted",
  );
  await expect(nav.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/pperezcardenal",
  );
});

test("the placeholder types example usernames", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const input = page.getByLabel("GitHub username");
  await expect
    .poll(async () => (await input.getAttribute("placeholder")) ?? "")
    .not.toBe("torvalds");
});

test("reduced motion keeps a static placeholder and a drawn line", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const input = page.getByLabel("GitHub username");
  await expect(input).toHaveAttribute("placeholder", "torvalds");
  await page.waitForTimeout(700);
  await expect(input).toHaveAttribute("placeholder", "torvalds");
  await expect(page.locator("polyline.signature-line")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("the layout holds on a portrait phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
