import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import type { History } from "../src/domain/history";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

/**
 * A history with every solo scene's data: several years, a changing mix of
 * contributions, public repositories and a language.
 */
function richHistory(): History {
  const mixes = [
    { commits: 920, pullRequests: 40, reviews: 0, issues: 40 },
    { commits: 700, pullRequests: 120, reviews: 60, issues: 20 },
    { commits: 500, pullRequests: 150, reviews: 200, issues: 30 },
    { commits: 570, pullRequests: 170, reviews: 220, issues: 40 },
  ];
  const years = [2019, 2021, 2023, 2025].map((year, index) => ({
    ...makeYear(year, steadyDays(year, 2 + index, 2)),
    totals: {
      ...(mixes[index] ?? mixes[0]),
      privateContributions: index === 3 ? 30 : 0,
    },
    repoCommits: [
      { repo: "ada/alpha", commits: 120 * (index + 1), days: 40 },
      { repo: "ada/beta-with-a-long-name", commits: 30, days: 10 },
    ],
  })) as History["years"];
  return {
    ...makeHistory("ada", years),
    totals: years.reduce(
      (sum, year) => ({
        commits: sum.commits + year.totals.commits,
        pullRequests: sum.pullRequests + year.totals.pullRequests,
        reviews: sum.reviews + year.totals.reviews,
        issues: sum.issues + year.totals.issues,
        privateContributions:
          sum.privateContributions + year.totals.privateContributions,
      }),
      {
        commits: 0,
        pullRequests: 0,
        reviews: 0,
        issues: 0,
        privateContributions: 0,
      },
    ),
    longestStreak: { length: 12, start: "2023-03-01", end: "2023-03-12" },
    languages: [
      { name: "TypeScript", size: 90, share: 0.9, isOther: false },
      { name: "Other", size: 10, share: 0.1, isOther: true },
    ],
  };
}

const history = richHistory();

async function openExperience(page: Page) {
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: "ada",
          name: "Ada Lovelace",
          avatarUrl: "",
          createdAt: "2019-01-01T00:00:00Z",
          contributionYears: [2025, 2023, 2021, 2019],
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
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
}

const nextButton = (page: Page) => page.getByRole("button", { name: /^Next/ });
const prevButton = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });
const progress = (page: Page) =>
  page.getByRole("progressbar", { name: "Playback progress" });

/**
 * Lands on a scene already finished (explore) without waiting for it to play:
 * leaving a scene counts it as played, so one step past it and back reopens it.
 */
async function openSceneInExplore(page: Page, label: string) {
  const here = new RegExp(`^Scene \\d+ of \\d+: ${label}`);
  for (let step = 0; step < 12; step += 1) {
    const text = (await progress(page).getAttribute("aria-valuetext")) ?? "";
    if (here.test(text)) break;
    await nextButton(page).click();
  }
  await expect(progress(page)).toHaveAttribute("aria-valuetext", here);
  await nextButton(page).click();
  await prevButton(page).click();
  await expect(progress(page)).toHaveAttribute("aria-valuetext", here);
  await expect(
    page.getByRole("button", { name: "Replay" }).first(),
  ).toBeVisible();
}

async function openFinale(page: Page) {
  const scenes = await page.locator("[data-scene-tick]").count();
  for (let scene = 0; scene < scenes; scene += 1) {
    await nextButton(page).click();
  }
  await expect(
    page.getByRole("heading", { name: "Take it with you." }),
  ).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("big numbers fit their frame and show the role mix", async ({
      page,
    }) => {
      await openExperience(page);
      await openSceneInExplore(page, "Big numbers");

      const strip = page.getByRole("region", { name: "How the mix changed" });
      await expect(strip).toBeVisible();
      await expect(
        strip.getByRole("img", { name: /^2019: 92% commits/ }),
      ).toBeVisible();
      await expect(strip.getByRole("img", { name: /^2025: / })).toBeVisible();
      await expectSceneFits(page);
    });

    test("the poster and its share cards fit and stay tappable", async ({
      page,
    }) => {
      await openExperience(page);
      await openFinale(page);
      await expect(
        page.getByRole("button", { name: "Poster card" }),
      ).toBeVisible();
      await expectSceneFits(page, { tapTargets: true });
    });
  });
}

test.describe("share cards", () => {
  test("lists the three cards and saves the chosen one as a 9:16 PNG", async ({
    page,
  }) => {
    await openExperience(page);
    await openFinale(page);

    for (const name of ["Poster card", "Rhythm card", "Eras card"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await expect(
      page.getByRole("button", { name: "Poster card" }),
    ).toHaveAttribute("aria-pressed", "true");

    const [poster] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Save image" }).click(),
    ]);
    expect(poster.suggestedFilename()).toBe("committed-ada-poster.png");
    await expectPng(await poster.path());
    await expect(
      page.getByRole("status").filter({ hasText: "Saved" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Eras card" }).click();
    await expect(
      page.getByRole("button", { name: "Eras card" }),
    ).toHaveAttribute("aria-pressed", "true");
    const [eras] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Save image" }).click(),
    ]);
    expect(eras.suggestedFilename()).toBe("committed-ada-eras.png");
    await expectPng(await eras.path());
  });
});

/** A PNG signature, then an IHDR of exactly 1080 x 1920 (9:16). */
async function expectPng(path: string | null) {
  expect(path).not.toBeNull();
  const bytes = await readFile(path as string);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1920);
}
