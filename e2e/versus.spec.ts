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

test("Play loads each history in order, then lists every developer without ranking", async ({
  page,
}) => {
  const requests = await mockHistory(page);
  await page.goto("/ada/grace/linus");
  await play(page).click();
  await expect(page.getByText("Temporary summary")).toBeVisible();
  expect(requests).toEqual(["ada", "grace", "linus"]);

  const rows = page.getByRole("listitem").filter({ hasText: "calendar" });
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("@ada");
  await expect(rows.nth(2)).toContainText("@linus");
  await expect(page.getByText(/winner|best|most productive/i)).toHaveCount(0);
});

test("it stops at the first login_required and requests nothing more", async ({
  page,
}) => {
  const requests = await mockHistory(page, ["grace"]);
  await page.goto("/ada/grace/linus");
  await play(page).click();
  await expect(page.getByText(/Free runs used for today/)).toBeVisible();
  expect(requests).toEqual(["ada", "grace"]);
});
