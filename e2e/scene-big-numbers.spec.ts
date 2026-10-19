import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

type Mix = {
  commits: number;
  pullRequests: number;
  reviews: number;
  issues: number;
};

const NORMAL: Mix = { commits: 920, pullRequests: 40, reviews: 20, issues: 40 };
const NINE_DIGITS: Mix = {
  commits: 123_456_789,
  pullRequests: 234_567_891,
  reviews: 345_678_912,
  issues: 456_789_123,
};

const YEARS = [2022, 2025];

async function openBigNumbers(page: Page, mix: Mix) {
  const years = YEARS.map((year) => ({
    ...makeYear(year, steadyDays(year, 3, 2), { privateContributions: 12 }),
    totals: { ...mix, privateContributions: 12 },
    repoCommits: [],
  })) as ReturnType<typeof makeHistory>["years"];
  const base = makeHistory("ada", years);
  const history = {
    ...base,
    totals: {
      commits: mix.commits * YEARS.length,
      pullRequests: mix.pullRequests * YEARS.length,
      reviews: mix.reviews * YEARS.length,
      issues: mix.issues * YEARS.length,
      privateContributions: 24,
    },
  };
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: "ada",
          name: "Ada Lovelace",
          avatarUrl: "",
          createdAt: "2022-01-01T00:00:00Z",
          contributionYears: [...YEARS].reverse(),
        },
      },
    }),
  );
  await page.route("**/api/history/*", (route) =>
    route.fulfill({
      json: { source: "cache", reposTruncated: false, history },
    }),
  );
  await page.goto("/ada");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const progress = page.getByRole("progressbar", { name: "Playback progress" });
  const here = /^Scene \d+ of \d+: Big numbers/;
  const next = page.getByRole("button", { name: /^Next/ });
  for (let step = 0; step < 12; step += 1) {
    if (here.test((await progress.getAttribute("aria-valuetext")) ?? "")) break;
    await next.click();
  }
  // Leaving a scene marks it played; one step past it and back opens it done.
  await next.click();
  await page.getByRole("button", { name: "Previous scene" }).click();
  await expect(progress).toHaveAttribute("aria-valuetext", here);
  await expect(
    page.getByRole("button", { name: "Replay" }).first(),
  ).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test.describe(`big numbers at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const [name, mix] of [
      ["regular totals", NORMAL],
      ["9-digit totals", NINE_DIGITS],
    ] as const) {
      test(`fits without scrolling with ${name}`, async ({ page }) => {
        await openBigNumbers(page, mix);
        await expect(
          page.getByText("Public only", { exact: true }),
        ).toBeVisible();
        await expect(page.getByText(/private contributions/)).toHaveClass(
          /sr-only/,
        );
        await expectSceneFits(page, { tapTargets: true, allowScroll: false });
        // Every number stays inside its own tile.
        const tiles = page.locator("[data-tile]");
        for (let index = 0; index < 4; index += 1) {
          const tile = await tiles.nth(index).boundingBox();
          const count = await tiles
            .nth(index)
            .locator("[data-role=count]")
            .boundingBox();
          expect(tile && count).toBeTruthy();
          if (!tile || !count) continue;
          expect(count.x).toBeGreaterThanOrEqual(tile.x - 1);
          expect(count.y).toBeGreaterThanOrEqual(tile.y - 1);
          expect(count.x + count.width).toBeLessThanOrEqual(
            tile.x + tile.width + 1,
          );
          expect(count.y + count.height).toBeLessThanOrEqual(
            tile.y + tile.height + 1,
          );
        }
      });
    }
  });
}
