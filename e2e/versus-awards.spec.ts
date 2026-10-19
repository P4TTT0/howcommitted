import { expect, type Page, test } from "@playwright/test";
import type { DailyContributions } from "../src/domain/types";
import { makeHistory, makeYear } from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const play = (page: Page) => page.getByRole("button", { name: "Play" });
const next = (page: Page) => page.getByRole("button", { name: /^Next/ });

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function daysOf(
  year: number,
  count: (date: string, weekday: number) => number,
): DailyContributions[] {
  const days: DailyContributions[] = [];
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1); ms <= end; ms += 86_400_000) {
    const n = count(iso(ms), new Date(ms).getUTCDay());
    if (n > 0) days.push({ date: iso(ms), count: n });
  }
  return days;
}

type Profile = {
  years: number[];
  count: (date: string, weekday: number) => number;
  reviews: number;
  pullRequests: number;
};

/** 39 characters, one unbreakable word. */
const LONG_A = "ab".repeat(20).slice(0, 39);
const LONG_B = "cd".repeat(20).slice(0, 39);

const PROFILES: Record<string, Profile> = {
  ada: {
    years: [2021, 2022, 2023],
    count: (date, weekday) =>
      (date >= "2022-03-01" && date <= "2022-04-15") ||
      (weekday >= 1 && weekday <= 4)
        ? 4
        : 0,
    reviews: 120,
    pullRequests: 40,
  },
  grace: {
    years: [2020, 2021, 2022, 2023],
    count: (_date, weekday) => (weekday === 0 || weekday === 6 ? 7 : 0),
    reviews: 10,
    pullRequests: 12,
  },
  linus: {
    years: [2022, 2023],
    count: (date) => (Number(date.slice(8)) % 2 === 0 ? 2 : 0),
    reviews: 5,
    pullRequests: 90,
  },
  margaret: {
    years: [2022, 2023],
    count: (_date, weekday) => (weekday === 3 ? 9 : 0),
    reviews: 0,
    pullRequests: 0,
  },
  "a-very-long-github-login-of-thirty-nine": {
    years: [2023],
    count: (_date, weekday) => (weekday === 5 ? 3 : 1),
    reviews: 3,
    pullRequests: 3,
  },
  [LONG_A]: {
    years: [2021, 2022, 2023],
    // Eight digits in total.
    count: (date) => (Number(date.slice(8)) % 2 === 0 ? 30_000 : 0),
    reviews: 1_200_000,
    pullRequests: 800_000,
  },
  [LONG_B]: {
    years: [2023],
    count: (_date, weekday) => (weekday >= 1 && weekday <= 5 ? 120_000 : 0),
    reviews: 3,
    pullRequests: 3_000_000,
  },
};

async function open(page: Page, logins: string[]) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    const profile = PROFILES[login] as Profile;
    const history = makeHistory(
      login,
      profile.years.map((year) =>
        makeYear(year, daysOf(year, profile.count), {
          privateContributions: 0,
        }),
      ),
    );
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: {
          ...history,
          languages: [],
          totals: {
            ...history.totals,
            reviews: profile.reviews,
            pullRequests: profile.pullRequests,
          },
        },
      },
    });
  });
  // The avatars are remote; the fallback initial must carry the layout.
  await page.route("https://github.com/*.png*", (route) => route.abort());
  await page.goto(`/${logins.join("/")}`);
  await play(page).click();
  const awards = page.getByRole("region", { name: "Awards" });
  for (let step = 0; step < 10 && !(await awards.isVisible()); step += 1) {
    await next(page).click();
  }
  await expect(awards).toBeVisible();
  return awards;
}

const LINEUPS = [
  { name: "2 developers", logins: ["ada", "grace"] },
  { name: "3 developers", logins: ["ada", "grace", "linus"] },
  {
    name: "5 developers",
    logins: [
      "ada",
      "grace",
      "linus",
      "margaret",
      "a-very-long-github-login-of-thirty-nine",
    ],
  },
  { name: "39-character logins and 8-digit values", logins: [LONG_A, LONG_B] },
] as const;

for (const viewport of VIEWPORTS) {
  for (const lineup of LINEUPS) {
    test(`awards fit at ${viewport.name} with ${lineup.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const awards = await open(page, [...lineup.logins]);
      // Only a phone may scroll the scene.
      await expectSceneFits(page, {
        allowScroll: viewport.width < 768,
        tapTargets: true,
      });

      if (viewport.width >= 768) {
        const sizes = await awards
          .locator("[data-award-card]")
          .evaluateAll((cards) =>
            cards.map((card) => {
              const box = card.getBoundingClientRect();
              return `${Math.round(box.width)}x${Math.round(box.height)}`;
            }),
          );
        expect(sizes.length).toBeGreaterThanOrEqual(lineup.logins.length);
        expect(new Set(sizes).size, sizes.join(" ")).toBe(1);
      }
    });
  }
}

test("awards name habits, one column per developer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const awards = await open(page, ["ada", "grace", "linus"]);
  await expect(page.getByText("Habits, not scores")).toBeVisible();
  await expect(page.getByText("Every award names a habit")).toHaveCount(0);
  await expect(awards.getByText(/^@/)).toHaveCount(3);
  await expect(awards).toContainText("Longest streak");
  await expect(awards).not.toContainText(/\bmost\b/i);
  // Avatars failed to load: the initial stands in.
  await expect(awards.locator("img")).toHaveCount(0);
});
