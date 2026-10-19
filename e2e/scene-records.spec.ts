import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

type Profile = {
  login: string;
  years: number[];
  /** Contributions on every active day. */
  perDay: number;
  /** Days between active days; 1 is a streak through the whole range. */
  every: number;
};

const NORMAL: Profile = {
  login: "ada",
  years: [2022, 2023, 2025],
  perDay: 4,
  every: 2,
};

/** 8-digit counts and a streak that spans years, for the longest strings. */
const STRESS: Profile = {
  login: "ada",
  years: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
  perDay: 12_345_678,
  every: 1,
};

async function openExperience(page: Page, profile: Profile) {
  const years = profile.years.map((year) =>
    makeYear(year, steadyDays(year, profile.perDay, profile.every)),
  );
  const history = {
    ...makeHistory(profile.login, years),
    languages: [
      { name: "TypeScript", size: 90, share: 0.9, isOther: false },
      { name: "Other", size: 10, share: 0.1, isOther: true },
    ],
  };
  const first = profile.years[0] ?? 2022;
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

/** Lands on a scene already finished (explore): step past it and back. */
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

/** Laptop sizes where the tiles get shorter than their content. */
const LAPTOPS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1536x864", width: 1536, height: 864 },
  { name: "1920x950", width: 1920, height: 950 },
] as const;

const MIN_INSET = 8;

/** Every tile's label, value and caption keeps 8px from the tile's padding box. */
async function expectTextInsideTiles(page: Page) {
  const problems = await page.evaluate((minInset) => {
    const found: string[] = [];
    const tiles = document.querySelectorAll<HTMLElement>(
      '[aria-label="Records"] > li',
    );
    for (const tile of tiles) {
      const style = getComputedStyle(tile);
      const outer = tile.getBoundingClientRect();
      const inner = {
        left: outer.left + Number.parseFloat(style.borderLeftWidth),
        right: outer.right - Number.parseFloat(style.borderRightWidth),
        top: outer.top + Number.parseFloat(style.borderTopWidth),
        bottom: outer.bottom - Number.parseFloat(style.borderBottomWidth),
      };
      for (const text of tile.querySelectorAll<HTMLElement>("p, p span")) {
        const rect = text.getBoundingClientRect();
        const name = `${tile.dataset.tile}: "${text.textContent?.trim()}"`;
        const gaps = {
          left: rect.left - inner.left,
          right: inner.right - rect.right,
          top: rect.top - inner.top,
          bottom: inner.bottom - rect.bottom,
        };
        for (const [side, gap] of Object.entries(gaps)) {
          if (gap < minInset - 0.5) {
            found.push(`tile ${name} is ${Math.round(gap)}px from the ${side}`);
          }
        }
        if (getComputedStyle(text).textAlign === "right") {
          found.push(`tile ${name} is right-aligned`);
        }
      }
    }
    return found;
  }, MIN_INSET);
  expect(problems, problems.join("\n")).toEqual([]);
}

for (const viewport of [...VIEWPORTS, ...LAPTOPS]) {
  const phone = viewport.width < 768;
  test.describe(`records at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const [name, profile] of [
      ["a typical history", NORMAL],
      ["8-digit counts and a multi-year streak", STRESS],
    ] as const) {
      test(`fits with ${name}`, async ({ page }) => {
        await openExperience(page, profile);
        await openSceneInExplore(page, "Records");
        await expect(page.getByRole("list", { name: "Records" })).toBeVisible();
        await expect(page.getByText("Your own marks")).toHaveCount(0);
        await expectSceneFits(page, {
          tapTargets: true,
          allowScroll: phone,
        });
        await expectTextInsideTiles(page);
      });
    }
  });
}
