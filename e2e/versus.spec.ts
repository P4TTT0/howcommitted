import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";

const play = (page: Page) => page.getByRole("button", { name: "Play" });

/** Replies to /api/history/{login}; `blocked` logins hit the anonymous quota. */
async function mockHistory(page: Page, blocked: string[] = []) {
  const requests: string[] = [];
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    requests.push(login);
    if (blocked.includes(login)) {
      await route.fulfill({
        status: 401,
        json: { error: { code: "login_required", message: "Free runs used." } },
      });
      return;
    }
    const days = login === "ada" ? 2 : 3;
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: makeHistory(login, [
          makeYear(2023, steadyDays(2023, days)),
          makeYear(2024, steadyDays(2024, days)),
        ]),
      },
    });
  });
  return requests;
}

test("a versus path waits for Play and fetches nothing before it", async ({
  page,
}) => {
  const requests = await mockHistory(page);
  await page.goto("/ada/grace/linus");
  await expect(page.getByRole("heading", { name: "Versus" })).toBeVisible();
  await expect(play(page)).toBeVisible();
  expect(requests).toEqual([]);
});

test("Play loads each history in order, then plays the race and the finale without ranking", async ({
  page,
}) => {
  const requests = await mockHistory(page);
  await page.goto("/ada/grace/linus");
  await play(page).click();

  // The race: one fixed lane per developer, in the order they were added.
  const race = page.getByRole("region", {
    name: /^Cumulative contributions from 2023 to 2024/,
  });
  await expect(race).toBeVisible();
  expect(requests).toEqual(["ada", "grace", "linus"]);
  const lanes = race.getByRole("listitem");
  await expect(lanes).toHaveCount(3);
  await expect(lanes.nth(0)).toContainText("@ada");
  await expect(lanes.nth(2)).toContainText("@linus");
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();

  // The same controls as solo: Next moves on to the finale.
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(
    page.getByText(
      "Contributions are not productivity. This is rhythm, not value.",
    ),
  ).toBeVisible();
  const finale = page.getByRole("region", { name: "Versus summary" });
  await expect(finale).toBeVisible();
  await expect(finale.getByRole("button", { name: "Replay" })).toBeVisible();
  await expect(
    finale.getByRole("link", { name: "Search again" }),
  ).toBeVisible();
  await expect(
    page.getByText("contributions, 2023 to 2024").first(),
  ).toBeVisible();

  await expect(
    page.getByText(/winner|best|most productive|leader/i),
  ).toHaveCount(0);
});

test("it stops at the first login_required and requests nothing more", async ({
  page,
}) => {
  const requests = await mockHistory(page, ["grace"]);
  await page.goto("/ada/grace/linus");
  await play(page).click();
  await expect(page.getByText(/^Free runs used\./)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" }),
  ).toHaveAttribute(
    "href",
    `/api/auth/github?returnTo=${encodeURIComponent("/ada/grace/linus")}`,
  );
  expect(requests).toEqual(["ada", "grace"]);
});
