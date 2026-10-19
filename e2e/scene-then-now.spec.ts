import { expect, type Page, test } from "@playwright/test";
import type { DailyContributions } from "../src/domain/types";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

/** "Now" is the last full year; the three before it can be "then". */
const NOW = new Date().getUTCFullYear() - 1;
const YEARS = [NOW - 3, NOW - 2, NOW - 1, NOW];

type Profile = {
  name: string;
  /** Daily contributions per year, oldest first. */
  days: DailyContributions[][];
};

const PROFILES: Profile[] = [
  {
    name: "a regular history",
    days: [
      steadyDays(YEARS[0] ?? 0, 3, 2),
      steadyDays(YEARS[1] ?? 0, 2, 3),
      steadyDays(YEARS[2] ?? 0, 6, 4),
      steadyDays(YEARS[3] ?? 0, 4, 1),
    ],
  },
  {
    name: "8-digit counts",
    days: YEARS.map((year) => steadyDays(year, 12_345_678, 150)),
  },
  {
    name: "one empty year",
    days: [
      steadyDays(YEARS[0] ?? 0, 3, 2),
      [],
      steadyDays(YEARS[2] ?? 0, 6, 4),
      steadyDays(YEARS[3] ?? 0, 4, 1),
    ],
  },
];

async function openExperience(page: Page, profile: Profile) {
  const history = makeHistory(
    "ada",
    YEARS.map((year, index) => makeYear(year, profile.days[index] ?? [])),
  );
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: "ada",
          name: "Ada Lovelace",
          avatarUrl: "",
          createdAt: `${YEARS[0]}-01-01T00:00:00Z`,
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
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
}

const nextButton = (page: Page) => page.getByRole("button", { name: /^Next/ });
const prevButton = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });
const progress = (page: Page) =>
  page.getByRole("progressbar", { name: "Playback progress" });

/** Lands on the scene already finished (explore): one step past it and back. */
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

for (const viewport of VIEWPORTS) {
  test.describe(`then vs now at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const profile of PROFILES) {
      test(`fits and stays tappable with ${profile.name}`, async ({ page }) => {
        await openExperience(page, profile);
        await openSceneInExplore(page, "Then vs now");
        await expect(
          page.getByRole("img", { name: /^Then \d{4}:/ }),
        ).toBeVisible();

        const picker = page.getByRole("toolbar", {
          name: "Choose the year to compare with",
        });
        await expect(picker.getByRole("button")).toHaveCount(3);
        await expectSceneFits(page, { tapTargets: true, allowScroll: false });

        // Every year the picker offers keeps the pair inside the frame.
        for (const year of YEARS.slice(0, 3)) {
          await picker.getByRole("button", { name: String(year) }).click();
          await expect(
            page.getByRole("img", { name: new RegExp(`^Then ${year}:`) }),
          ).toBeVisible();
          await expectSceneFits(page, {
            tapTargets: true,
            allowScroll: false,
          });
        }
      });
    }
  });
}
