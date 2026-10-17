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
const TOTAL = history.totalContributions.toLocaleString("en-US");

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

const pauseButton = (page: Page) => page.getByRole("button", { name: "Pause" });
/** Skips every scene in turn (one more than the scene ticks); the end card follows. */
async function skipAllScenes(page: Page) {
  const skip = page.getByRole("button", { name: "Skip scene" });
  await expect(skip).toBeEnabled();
  const scenes = (await page.locator("[data-scene-tick]").count()) + 1;
  for (let scene = 0; scene < scenes; scene += 1) {
    await expect(skip).toBeEnabled();
    await skip.click();
  }
}

const startButton = (page: Page) =>
  page.getByRole("button", { name: "Play", exact: true });
/** The landing call to action: "Play", or "Play @login" once a user is found. */
const listenButton = (page: Page) =>
  page.getByRole("button", { name: /^Play( @\w+)?$/ }).first();

test("search shows a preview, then the click opens the experience", async ({
  page,
}) => {
  const mocks = await mockApi(page);
  await page.goto("/");

  const button = listenButton(page);
  await expect(button).toHaveAttribute("aria-disabled", "true");

  await page.getByLabel("GitHub username").fill("ada");
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText("Active 2022–2024")).toBeVisible();
  await expect(button).toHaveAttribute("aria-disabled", "false");
  // The preview alone never spends a generation.
  expect(mocks.historyRequests).toHaveLength(0);

  await button.click();
  await expect(page).toHaveURL(/\/ada$/);
  // The history request goes out right after the navigation, not with it.
  await expect.poll(() => mocks.historyRequests.length).toBe(1);

  // Audio was unlocked by the landing click, so the scene starts by itself.
  await expect(pauseButton(page)).toBeEnabled();
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
  await expect(listenButton(page)).toHaveAttribute("aria-disabled", "true");
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
  await expect(pauseButton(page)).toBeEnabled();
  expect(mocks.historyRequests).toHaveLength(1);
});

test("scenes play in order, with a progress bar that names the scene", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/ada");
  await startButton(page).click();

  const progress = page.getByRole("progressbar", {
    name: "Playback progress",
  });
  await expect(pauseButton(page)).toBeEnabled();
  await expect(progress).toHaveAttribute(
    "aria-valuetext",
    "Scene 1 of 2: Year blocks",
  );
  // One block per year: height is the calendar total of the year.
  const perYear = history.years
    .map(
      (year) =>
        `${year.year} ${year.totalContributions.toLocaleString("en-US")}`,
    )
    .join(", ");
  await expect(
    page.getByRole("img", { name: `Contributions per year: ${perYear}` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Skip scene" }).click();
  await expect(progress).toHaveAttribute(
    "aria-valuetext",
    "Scene 2 of 2: Cumulative line",
  );
  await expect(
    page.getByRole("img", { name: /^Cumulative contributions/ }),
  ).toBeVisible();
});

test("pausing holds the position and resuming continues", async ({ page }) => {
  await mockApi(page);
  await page.goto("/ada");
  await startButton(page).click();
  await expect(pauseButton(page)).toBeEnabled();
  await page.waitForTimeout(600);
  await pauseButton(page).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

  const fill = page.getByRole("progressbar").locator("div").first();
  const held = await fill.evaluate((element) => element.style.width);
  await page.waitForTimeout(800);
  expect(await fill.evaluate((element) => element.style.width)).toBe(held);

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(pauseButton(page)).toBeVisible();
  await expect
    .poll(() => fill.evaluate((element) => element.style.width))
    .not.toBe(held);
});

test("skipping while paused loads the next scene paused; mute carries over", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/ada");
  await startButton(page).click();
  await expect(pauseButton(page)).toBeEnabled();
  await page.getByRole("button", { name: "Mute" }).click();
  await pauseButton(page).click();
  await page.getByRole("button", { name: "Skip scene" }).click();

  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    /^Scene 2 of /,
  );
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("skipping to the end shows the total and the principle", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/ada");
  await startButton(page).click();
  await skipAllScenes(page);

  await expect(
    page.getByText(
      "Contributions are not productivity. This is rhythm, not value.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(`@ada: ${TOTAL} contributions, 2022 to 2024`),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replay" }).first(),
  ).toBeVisible();
});

test("a user with no contributions gets a calm empty state", async ({
  page,
}) => {
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
    page.getByRole("main").getByText(/No contributions found for @ada/),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(
        "Private contributions only appear if @ada shares them on their GitHub profile.",
      ),
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
  await expect(pauseButton(page)).toBeEnabled();
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
  await listenButton(page).click();
  await expect(pauseButton(page)).toBeEnabled();
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

test("contributions not attributed to a day show as a labelled step with an honest note", async ({
  page,
}) => {
  const year = makeYear(2023, steadyDays(2023, 1), 1000);
  const missing = (
    year.totalContributions -
    year.dailyContributions.reduce((sum, day) => sum + day.count, 0)
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
  await skipAllScenes(page);

  await expect(
    page.getByText(`+${missing} not attributed to a day`),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByText(
        `${missing} contributions in 2023 are not attributed to a day; yearly totals are exact.`,
      )
      .first(),
  ).toBeVisible();
  // The total is the official one, not the sum of the days.
  await expect(page.getByText("@ada: 1,000 contributions, 2023")).toBeVisible();
});

test("a profile with only private contributions plays the full calendar", async ({
  page,
}) => {
  // mngobbi-like: no public commits, everything comes from the calendar.
  const days = steadyDays(2026, 8, 1).filter((day) => day.date <= "2026-08-26");
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const privateOnly = makeHistory("ada", [
    makeYear(2026, days, {
      official: total,
      commits: 0,
      privateContributions: total,
    }),
  ]);
  await mockApi(page, {
    status: 200,
    body: { source: "cache", reposTruncated: false, history: privateOnly },
  });
  await page.goto("/ada");
  await startButton(page).click();
  await skipAllScenes(page);

  const formatted = total.toLocaleString("en-US");
  await expect(
    page.getByText(`@ada: ${formatted} contributions, 2026`),
  ).toBeVisible();
  await expect(
    page.getByText(`Includes ${formatted} private contributions.`),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Contributions are not productivity. This is rhythm, not value.",
    ),
  ).toBeVisible();
});
