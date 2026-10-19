import { expect, type Page, test } from "@playwright/test";
import type { History } from "../src/domain/history";
import { makeHistory, makeYear } from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

type Habit = {
  name: string;
  login: string;
  /** Contributions on a day, given its weekday (0 = Sunday). */
  count: (weekday: number) => number;
  archetype: string;
};

const HABITS: Habit[] = [
  {
    name: "a weekday builder",
    login: "ada",
    count: (weekday) => (weekday >= 1 && weekday <= 4 ? 5 : 0),
    archetype: "Weekday builder",
  },
  {
    name: "8-digit weekday values and the steadiest label",
    login: "ada-stress-steady",
    count: () => 1_000_000,
    archetype: "Steady all week",
  },
  {
    name: "8-digit weekday values and the longest label",
    login: "ada-stress-weekend",
    count: (weekday) => (weekday === 0 || weekday === 6 ? 1_000_000 : 1),
    archetype: "Weekend regular",
  },
];

function historyOf(habit: Habit): History {
  const days = [];
  for (
    let ms = Date.UTC(2025, 0, 1);
    ms <= Date.UTC(2025, 11, 31);
    ms += 86_400_000
  ) {
    const date = new Date(ms);
    const count = habit.count(date.getUTCDay());
    if (count > 0) days.push({ date: date.toISOString().slice(0, 10), count });
  }
  return makeHistory(habit.login, [makeYear(2025, days)]);
}

async function openWeekShape(page: Page, habit: Habit) {
  const history = historyOf(habit);
  await page.route("**/api/user/*", (route) =>
    route.fulfill({
      json: {
        user: {
          login: habit.login,
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
  await page.goto(`/${habit.login}`);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();

  const progress = page.getByRole("progressbar", {
    name: "Playback progress",
  });
  const next = page.getByRole("button", { name: /^Next/ });
  const here = /^Scene \d+ of \d+: Week shape/;
  for (let step = 0; step < 12; step += 1) {
    if (here.test((await progress.getAttribute("aria-valuetext")) ?? "")) break;
    await next.click();
  }
  await expect(progress).toHaveAttribute("aria-valuetext", here);
  // Leaving a scene counts it as played: one step on and back reopens it done.
  await next.click();
  await page.getByRole("button", { name: "Previous scene" }).click();
  await expect(progress).toHaveAttribute("aria-valuetext", here);
  await expect(
    page.getByRole("button", { name: "Replay" }).first(),
  ).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const habit of HABITS) {
      test(`the week shape fits without scrolling for ${habit.name}`, async ({
        page,
      }) => {
        await openWeekShape(page, habit);
        await expect(
          page.getByText(habit.archetype, { exact: true }).first(),
        ).toBeVisible();
        await expectSceneFits(page, { tapTargets: true, allowScroll: false });

        // The picked day's readout takes over the rhythm strip and still fits.
        await page.locator('[data-role="bars"]').focus();
        await expect(page.locator('[data-role="readout"]')).toBeVisible();
        await expectSceneFits(page, { tapTargets: true, allowScroll: false });
      });
    }
  });
}
