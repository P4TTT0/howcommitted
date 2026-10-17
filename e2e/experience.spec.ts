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
type Reply = { status: number; body: unknown };

const okReply: Reply = {
  status: 200,
  body: { source: "cache", reposTruncated: false, history },
};

/** Total as the end card prints it, derived from the fixture. */
const TOTAL = history.totals.commits.toLocaleString("en-US");

/** Mocks the two API routes; `ghost` does not exist, everything else is `ada`. */
async function mockApi(
  page: Page,
  reply: Reply | ((request: number) => Reply) = okReply,
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
    const { status, body } =
      typeof reply === "function" ? reply(mocks.historyRequests.length) : reply;
    await route.fulfill({ status, json: body });
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

test("our own lookup limit is worded as traffic, with Retry-After", async ({
  page,
}) => {
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      status: 429,
      headers: { "retry-after": "120" },
      json: {
        error: { code: "rate_limited", message: "Slow.", reason: "ip_limit" },
      },
    }),
  );
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  await expect(
    page.getByText("Too many requests right now. Try again in 2 minutes."),
  ).toBeVisible();
});

test("a reserved login is refused before any request", async ({ page }) => {
  let lookups = 0;
  await page.route("**/api/user/*", async (route) => {
    lookups += 1;
    await route.fulfill({ json: preview });
  });
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("lab");
  await expect(page.getByText(/collides with a Committed page/)).toBeVisible();
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
  await expect(
    page.getByText(`@ada: ${TOTAL} commits, 2022 to 2024`),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replay" }).first(),
  ).toBeVisible();
});

test("a user with no commits gets a calm empty state", async ({ page }) => {
  await mockApi(page, {
    status: 200,
    body: {
      source: "cache",
      reposTruncated: false,
      history: makeHistory("ada", [makeYear(2024, [])]),
    },
  });
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page.getByRole("main").getByText(/No public commits found for @ada/),
  ).toBeVisible();
});

test("history errors become designed states", async ({ page }) => {
  await mockApi(page, {
    status: 401,
    body: { error: { code: "login_required", message: "Free runs used." } },
  });
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page
      .getByRole("main")
      .getByText(
        "Free runs used for today. Sign in with GitHub is coming soon.",
      ),
  ).toBeVisible();
  await expect(page.getByText(/login_required|"error"/)).toHaveCount(0);
});

test("a rate limited history offers a retry that can succeed", async ({
  page,
}) => {
  const mocks = await mockApi(page, (request) =>
    request === 1
      ? {
          status: 429,
          body: {
            error: {
              code: "rate_limited",
              message: "GitHub needs a breather.",
            },
          },
        }
      : okReply,
  );
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page
      .getByRole("main")
      .getByText("GitHub needs a breather. Try again in a minute."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('[data-role="block"]')).toBeVisible();
  expect(mocks.historyRequests).toHaveLength(2);
});

test("our own limits are not blamed on GitHub", async ({ page }) => {
  await mockApi(page, {
    status: 503,
    body: {
      error: { code: "degraded", message: "Busy.", reason: "busy" },
    },
  });
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page
      .getByRole("main")
      .getByText("Too many requests right now. Try again in a minute."),
  ).toBeVisible();
});

test("an unreachable server gets a connection message", async ({ page }) => {
  await page.route("**/api/history/*", (route) => route.abort());
  await page.goto("/ada");
  await startButton(page).click();
  await expect(
    page
      .getByRole("main")
      .getByText("Could not reach Committed. Check your connection."),
  ).toBeVisible();
});

test("back and forward never spend a run without a click", async ({ page }) => {
  const mocks = await mockApi(page);
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await startButton(page).click();
  await expect(page.locator('[data-role="block"]')).toBeVisible();
  expect(mocks.historyRequests).toHaveLength(1);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/ada$/);

  // Audio is still unlocked in this document, yet the start button is back.
  await expect(startButton(page)).toBeVisible();
  expect(mocks.historyRequests).toHaveLength(1);
});

test("more than one segment is not found for now", async ({ page }) => {
  const response = await page.goto("/ada/grace");
  expect(response?.status()).toBe(404);
});

test("commits not attributed to a day show as a labelled step with an honest note", async ({
  page,
}) => {
  const year = makeYear(2023, steadyDays(2023, 1), 1000);
  const missing = (
    year.totals.commits - year.reconciliation.summed
  ).toLocaleString("en-US");
  await mockApi(page, {
    status: 200,
    body: {
      source: "cache",
      reposTruncated: false,
      history: makeHistory("ada", [year]),
    },
  });
  await page.goto("/ada");
  await startButton(page).click();
  const skip = page.getByRole("button", { name: "Skip" });
  await expect(skip).toBeEnabled();
  await skip.click();

  await expect(
    page.getByText(`+${missing} not attributed to a day`),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(
        `${missing} commits in 2023 are not attributed to a day; yearly totals are exact.`,
      )
      .first(),
  ).toBeVisible();
  // The total is the official one, not the sum of the days.
  await expect(page.getByText("@ada: 1,000 commits, 2023")).toBeVisible();
});
