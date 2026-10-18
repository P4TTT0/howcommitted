import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import type { History } from "../src/domain/history";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

type Totals = History["totals"];

type Profile = {
  login: string;
  years: number[];
  /** Official totals of the first year; later years scale from the last mix. */
  mixes: Pick<Totals, "commits" | "pullRequests" | "reviews" | "issues">[];
  privateContributions?: number;
  /** Public repositories, or none. */
  repos: { repo: string; commits: number; days: number }[];
  /** The calendar total of every year, to stress long numbers. */
  official?: number;
};

const MIXES = [
  { commits: 920, pullRequests: 40, reviews: 0, issues: 40 },
  { commits: 700, pullRequests: 120, reviews: 60, issues: 20 },
  { commits: 500, pullRequests: 150, reviews: 200, issues: 30 },
  { commits: 570, pullRequests: 170, reviews: 220, issues: 40 },
];

const REPOS = [
  { repo: "ada/alpha", commits: 120, days: 40 },
  { repo: "ada/beta", commits: 30, days: 10 },
];

/** A history with every solo scene's data, shaped by `profile`. */
function historyOf(profile: Profile): History {
  const years = profile.years.map((year, index) => ({
    ...makeYear(year, steadyDays(year, 2 + (index % 4), 2), {
      ...(profile.official ? { official: profile.official } : {}),
      privateContributions: index === profile.years.length - 1 ? 30 : 0,
    }),
    totals: {
      ...(profile.mixes[index % profile.mixes.length] ?? MIXES[0]),
      privateContributions: index === profile.years.length - 1 ? 30 : 0,
    },
    repoCommits: profile.repos.map((repo) => ({
      ...repo,
      commits: repo.commits * (index + 1),
    })),
  })) as History["years"];
  const sum = (pick: (year: History["years"][number]) => number) =>
    years.reduce((total, year) => total + pick(year), 0);
  return {
    ...makeHistory(profile.login, years),
    totals: {
      commits: sum((y) => y.totals.commits),
      pullRequests: sum((y) => y.totals.pullRequests),
      reviews: sum((y) => y.totals.reviews),
      issues: sum((y) => y.totals.issues),
      privateContributions: sum((y) => y.totals.privateContributions),
    },
    longestStreak: { length: 12, start: "2023-03-01", end: "2023-03-12" },
    languages: [
      { name: "TypeScript", size: 90, share: 0.9, isOther: false },
      { name: "Other", size: 10, share: 0.1, isOther: true },
    ],
  };
}

const RICH: Profile = {
  login: "ada",
  years: [2019, 2021, 2023, 2025],
  mixes: MIXES,
  repos: REPOS,
};

/** What the stress runs stand for, each at every viewport. */
const STRESS: { name: string; profile: Profile }[] = [
  {
    name: "8-digit totals, a 39-character login and a long repository name",
    profile: {
      ...RICH,
      login: `ada${"-lovelace".repeat(4)}`,
      mixes: [
        {
          commits: 12_345_678,
          pullRequests: 23_456_789,
          reviews: 34_567_890,
          issues: 45_678_901,
        },
      ],
      official: 87_654_321,
      repos: [
        {
          repo: "ada/an-extremely-long-repository-name-that-never-seems-to-end",
          commits: 4_000_000,
          days: 900,
        },
      ],
    },
  },
  {
    name: "a single active year",
    profile: { ...RICH, years: [2025] },
  },
  {
    name: "no public repositories",
    profile: { ...RICH, repos: [] },
  },
];

async function openExperience(page: Page, profile: Profile = RICH) {
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

/** The Save button once the chosen card's image is ready; says why when not. */
async function readySave(page: Page) {
  const save = page.getByRole("button", { name: "Save image" });
  const status = page.getByRole("status").filter({ hasText: /./ });
  await expect(
    save,
    `Save image never became ready. Status line: "${(await status.allTextContents()).join(" / ")}"`,
  ).toBeEnabled({ timeout: 10_000 });
  return save;
}

async function checkBigNumbers(page: Page, profile: Profile) {
  await openExperience(page, profile);
  await openSceneInExplore(page, "Big numbers");
  const strip = page.getByRole("region", { name: "How the mix changed" });
  if (profile.years.length > 1) {
    await expect(strip).toBeVisible();
    await expect(strip.getByRole("img").first()).toBeVisible();
  } else {
    await expect(strip).toHaveCount(0);
  }
  await expectSceneFits(page, { tapTargets: true });
}

async function checkFinale(page: Page, profile: Profile) {
  await openExperience(page, profile);
  await openFinale(page);
  await expect(page.getByRole("button", { name: "Poster card" })).toBeVisible();
  await readySave(page);
  await expectSceneFits(page, { tapTargets: true });
}

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("big numbers fit their frame and show the role mix", async ({
      page,
    }) => {
      await checkBigNumbers(page, RICH);
      const strip = page.getByRole("region", { name: "How the mix changed" });
      await expect(
        strip.getByRole("img", { name: /^2019: 92% commits/ }),
      ).toBeVisible();
      await expect(strip.getByRole("img", { name: /^2025: / })).toBeVisible();
    });

    test("the poster and its share cards fit and stay tappable", async ({
      page,
    }) => {
      await checkFinale(page, RICH);
    });

    for (const stress of STRESS) {
      test(`big numbers fit with ${stress.name}`, async ({ page }) => {
        await checkBigNumbers(page, stress.profile);
      });

      test(`the poster fits with ${stress.name}`, async ({ page }) => {
        await checkFinale(page, stress.profile);
      });
    }
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
      page.waitForEvent("download", { timeout: 15_000 }),
      (await readySave(page)).click(),
    ]);
    expect(poster.suggestedFilename()).toBe("committed-ada-poster.png");
    await expectPng(await poster.path());
    await expect(
      page.getByRole("status").filter({ hasText: "Download started" }),
    ).toBeVisible();

    // Choosing another card clears the message and prepares that card.
    await page.getByRole("button", { name: "Eras card" }).click();
    await expect(
      page.getByRole("button", { name: "Eras card" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("status").filter({ hasText: "Download started" }),
    ).toHaveCount(0);
    const [eras] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      (await readySave(page)).click(),
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
