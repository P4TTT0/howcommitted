import { expect, type Page, test } from "@playwright/test";
import { makeHistory, makeYear } from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

type Case = {
  name: string;
  login: string;
  official: number;
  privateContributions: number;
  top: RegExp;
  tag: string | null;
  repo?: string;
};

const CASES: Case[] = [
  {
    name: "a profile with private contributions",
    login: "ada",
    official: 1029,
    privateContributions: 456,
    top: /^@ada · 2025$/,
    tag: "Includes 456 private",
  },
  {
    name: "a profile with zero private contributions",
    login: "grace",
    official: 1029,
    privateContributions: 0,
    top: /^@grace · 2025$/,
    tag: null,
  },
  {
    name: "a 39-character login and an 11-digit total",
    login: "a".repeat(39),
    official: 99_999_999_999,
    privateContributions: 12_345,
    top: /^@a{39} · 2025$/,
    tag: "Includes 12,345 private",
    repo: `portfolio-${"x".repeat(100)}`.slice(0, 100),
  },
];

async function openPoster(page: Page, item: Case) {
  const days = [];
  for (let day = 1; day <= 28; day += 1) {
    days.push({ date: `2025-03-${String(day).padStart(2, "0")}`, count: 3 });
  }
  const year = makeYear(2025, days, {
    official: item.official,
    privateContributions: item.privateContributions,
  });
  const history = {
    ...makeHistory(item.login, [
      {
        ...year,
        repoCommits: [
          {
            repo: `ada/${item.repo ?? "Portfolio-Flor-Frontend"}`,
            commits: 50,
            days: 10,
          },
        ],
      },
    ]),
    longestStreak: { length: 13, start: "2025-03-01", end: "2025-03-13" },
    languages: [{ name: "TypeScript", size: 90, share: 0.9, isOther: false }],
  };
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: item.login,
          name: null,
          avatarUrl: "",
          createdAt: "2025-01-01T00:00:00Z",
          contributionYears: [2025],
        },
      },
    }),
  );
  await page.route("**/api/history/*", (route) =>
    route.fulfill({
      json: { source: "cache", reposTruncated: false, history },
    }),
  );
  await page.goto(`/${item.login}`);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();

  const scenes = await page.locator("[data-scene-tick]").count();
  const next = page.getByRole("button", { name: /^Next/ });
  for (let scene = 0; scene < scenes; scene += 1) await next.click();
  await expect(
    page.getByRole("heading", { name: "Take it with you." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save poster image" }),
  ).toBeEnabled({ timeout: 10_000 });
}

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const item of CASES) {
      test(`the poster fits for ${item.name}`, async ({ page }) => {
        await openPoster(page, item);

        await expect(page.getByText(item.top)).toBeVisible();
        if (item.tag) await expect(page.getByText(item.tag)).toBeVisible();
        else await expect(page.getByText(/private/)).toHaveCount(0);
        await expect(
          page.getByText("Contributions.", { exact: true }),
        ).toBeVisible();
        for (const fact of [
          "Longest streak",
          "Rhythm",
          "Kept coming back to",
          "Built with",
        ]) {
          await expect(
            page.locator("dt").getByText(fact, { exact: true }),
          ).toBeVisible();
        }
        await expect(page.getByText("TypeScript")).toBeVisible();
        // Decluttered: no year bars, no helper sentence.
        await expect(page.getByRole("img", { name: /per year/ })).toHaveCount(
          0,
        );
        await expect(page.getByText(/Pick a card/)).toHaveCount(0);
        await expect(
          page.getByText(
            "Contributions are not productivity. This is rhythm, not value.",
          ),
        ).toBeVisible();

        await expectSceneFits(page, {
          tapTargets: true,
          allowScroll: viewport.width < 768,
        });

        // The share cards are real thumbnails, not a squashed strip.
        const thumb = page.locator("canvas").first();
        const box = await thumb.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThan((box?.width ?? 1) * 1.7);
        if (viewport.width < 768) {
          expect(box?.width ?? 0).toBeGreaterThan(viewport.width * 0.2);
        }
        const save = page.getByRole("button", { name: "Save poster image" });
        await save.scrollIntoViewIfNeeded();
        await expect(save).toBeInViewport();
      });
    }
  });
}
