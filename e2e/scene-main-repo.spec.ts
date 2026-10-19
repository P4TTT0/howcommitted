import { expect, type Page, test } from "@playwright/test";
import type { History } from "../src/domain/history";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

type Profile = {
  login: string;
  years: number[];
  repos: { repo: string; commits: number; days: number }[];
};

const REPOS = [
  { repo: "ada/analytical-engine", commits: 400, days: 120 },
  { repo: "ada/notes", commits: 150, days: 60 },
  { repo: "ada/difference", commits: 90, days: 30 },
  { repo: "ada/bernoulli", commits: 40, days: 12 },
  { repo: "ada/punch-cards", commits: 10, days: 4 },
];

const RICH: Profile = {
  login: "ada",
  years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
  repos: REPOS,
};

const STRESS: Profile = {
  login: `ada${"-lovelace".repeat(4)}`.slice(0, 39),
  years: RICH.years,
  repos: [
    { repo: `ada/${"x".repeat(100)}`, commits: 4_000_000, days: 900 },
    ...REPOS.slice(1),
  ],
};

function historyOf(profile: Profile): History {
  const years = profile.years.map((year, index) => ({
    ...makeYear(year, steadyDays(year, 2 + (index % 4), 2)),
    repoCommits: profile.repos.map((repo) => ({
      ...repo,
      commits: repo.commits * (index + 1),
    })),
  })) as History["years"];
  return makeHistory(profile.login, years);
}

async function openExperience(page: Page, profile: Profile) {
  const history = historyOf(profile);
  const first = profile.years[0] ?? 2019;
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: profile.login,
          name: "Ada Lovelace",
          avatarUrl: "",
          createdAt: `${first}-01-01T00:00:00Z`,
          contributionYears: [...profile.years].reverse(),
        },
      },
    }),
  );
  await page.route("**/api/history/*", (route) =>
    route.fulfill({
      json: { source: "cache", reposTruncated: false, history },
    }),
  );
  await page.goto(`/${profile.login}`);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
}

const nextButton = (page: Page) => page.getByRole("button", { name: /^Next/ });
const prevButton = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });
const progress = (page: Page) =>
  page.getByRole("progressbar", { name: "Playback progress" });

/** Lands on the scene already finished: one step past it and back reopens it. */
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
  test.describe(`at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const [name, profile] of [
      ["the main repo and its eras", RICH],
      ["a 39-character login, a 100-character repo and 8 eras", STRESS],
    ] as const) {
      test(`${name} fit without scrolling`, async ({ page }) => {
        await openExperience(page, profile);
        await openSceneInExplore(page, "Main repo");
        await expect(page.getByRole("img", { name: /^2026: / })).toBeVisible();
        await expectSceneFits(page, { tapTargets: true, allowScroll: false });
      });
    }
  });
}
