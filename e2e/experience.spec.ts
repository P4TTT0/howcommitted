import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/features/timeline/historyFixture";

const AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='%23141414'/></svg>";

const history = makeHistory("ada", [
  makeYear(2022, steadyDays(2022, 2)),
  makeYear(2023, steadyDays(2023, 3)),
  makeYear(2024, steadyDays(2024, 2)),
]);

const preview = {
  user: {
    login: "ada",
    name: "Ada Lovelace",
    avatarUrl: AVATAR,
    createdAt: "2022-01-01T00:00:00Z",
    contributionYears: [2024, 2023, 2022],
  },
};

type Mocks = { historyRequests: string[] };

/** Mocks the two API routes; `ghost` does not exist, everything else is `ada`. */
async function mockApi(
  page: Page,
  historyStatus = 200,
  historyBody: unknown = {
    source: "cache",
    reposTruncated: false,
    history,
  },
): Promise<Mocks> {
  const mocks: Mocks = { historyRequests: [] };
  await page.route("**/api/user/*", async (route) => {
    const login = new URL(route.request().url()).pathname.split("/").pop();
    if (login === "ghost") {
      await route.fulfill({
        status: 404,
        json: { error: { code: "not_found", message: "No GitHub user." } },
      });
      return;
    }
    await route.fulfill({ json: preview });
  });
  await page.route("**/api/history/*", async (route) => {
    mocks.historyRequests.push(route.request().url());
    await route.fulfill({ status: historyStatus, json: historyBody });
  });
  return mocks;
}

const startButton = (page: Page) =>
  page.getByRole("button", { name: "How Committed?" });

test("search shows a preview, then the click opens the experience", async ({
  page,
}) => {
  const mocks = await mockApi(page);
  await page.goto("/");

  const button = startButton(page);
  await expect(button).toHaveAttribute("aria-disabled", "true");

  await page.getByLabel("GitHub username").fill("ada");
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText("Active 2022 to 2024")).toBeVisible();
  await expect(button).toHaveAttribute("aria-disabled", "false");
  // The preview alone never spends a generation.
  expect(mocks.historyRequests).toHaveLength(0);

  await button.click();
  await expect(page).toHaveURL(/\/ada$/);
  expect(mocks.historyRequests).toHaveLength(1);

  // Audio was unlocked by the landing click, so the scene starts by itself.
  await expect(page.locator('[data-role="block"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Mute" })).toBeVisible();
});

test("pressing Enter on a found user starts the experience", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("@ada");
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await page.getByLabel("GitHub username").press("Enter");
  await expect(page).toHaveURL(/\/ada$/);
});

test("an unknown user gets a clear message and no start", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ghost");
  await expect(page.getByText("No GitHub user named @ghost")).toBeVisible();
  await expect(startButton(page)).toHaveAttribute("aria-disabled", "true");
  await page.getByLabel("GitHub username").press("Enter");
  await expect(page).toHaveURL(/\/$/);
});

test("an invalid username is rejected without a request", async ({ page }) => {
  let lookups = 0;
  await page.route("**/api/user/*", async (route) => {
    lookups += 1;
    await route.fulfill({ json: preview });
  });
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("-bad-");
  await expect(page.getByText(/GitHub usernames use letters/)).toBeVisible();
  expect(lookups).toBe(0);
});

test("a rate limited lookup says GitHub needs a breather", async ({ page }) => {
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      status: 429,
      json: { error: { code: "rate_limited", message: "Slow down." } },
    }),
  );
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  await expect(
    page.getByText("GitHub needs a breather. Try again in a minute."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a direct visit waits for a click and fetches nothing before it", async ({
  page,
}) => {
  const mocks = await mockApi(page);
  await page.goto("/ada");

  await expect(startButton(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "@ada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  expect(mocks.historyRequests).toHaveLength(0);

  await startButton(page).click();
  await expect(page.locator('[data-role="block"]')).toBeVisible();
  expect(mocks.historyRequests).toHaveLength(1);
});

test("skipping to the end shows the total and the principle", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/ada");
  await startButton(page).click();
  const skip = page.getByRole("button", { name: "Skip" });
  await expect(skip).toBeEnabled();
  await skip.click();

  await expect(
    page.getByText("Commits are not productivity. This is rhythm, not value."),
  ).toBeVisible();
  await expect(page.getByText("@ada: 854 commits, 2022 to 2024")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replay" }).first(),
  ).toBeVisible();
});

test("a user with no commits gets a calm empty state", async ({ page }) => {
  await mockApi(page, 200, {
    source: "cache",
    reposTruncated: false,
    history: makeHistory("ada", [makeYear(2024, [])]),
  });
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page.getByText(/No public commits found for @ada/),
  ).toBeVisible();
});

test("history errors become designed states", async ({ page }) => {
  await mockApi(page, 401, {
    error: { code: "login_required", message: "Free runs used." },
  });
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page.getByText(
      "Free runs used for today. Sign in with GitHub is coming soon.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/login_required|"error"/)).toHaveCount(0);
});

test("a rate limited history offers a retry", async ({ page }) => {
  await mockApi(page, 429, {
    error: { code: "rate_limited", message: "GitHub needs a breather." },
  });
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page.getByText("GitHub needs a breather. Try again in a minute."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("more than one segment is not found for now", async ({ page }) => {
  const response = await page.goto("/ada/grace");
  expect(response?.status()).toBe(404);
});
