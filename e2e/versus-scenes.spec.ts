import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import type { DailyContributions } from "../src/domain/types";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const play = (page: Page) => page.getByRole("button", { name: "Play" });
const next = (page: Page) => page.getByRole("button", { name: /^Next/ });

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Days of `year` for which `count` returns a positive number. */
function daysOf(
  year: number,
  count: (date: string, weekday: number) => number,
): DailyContributions[] {
  const days: DailyContributions[] = [];
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1); ms <= end; ms += 86_400_000) {
    const date = iso(ms);
    const n = count(date, new Date(ms).getUTCDay());
    if (n > 0) days.push({ date, count: n });
  }
  return days;
}

const language = (name: string, share: number) => ({
  name,
  size: share * 10_000,
  share,
  isOther: name === "Other",
});

type Profile = {
  years: number[];
  count: (date: string, weekday: number) => number;
  languages: ReturnType<typeof language>[];
  reviews: number;
  pullRequests: number;
  /** Shared private contributions per year, a count only. */
  privateContributions?: number;
};

/** 39 characters, one unbreakable word: the worst a login can do to a layout. */
const LONG_A = "ab".repeat(20).slice(0, 39);
const LONG_B = "cd".repeat(20).slice(0, 39);

/** Distinct habits: weekdays and a long streak, weekends, and every other day. */
const PROFILES: Record<string, Profile> = {
  ada: {
    years: [2021, 2022, 2023],
    count: (date, weekday) =>
      (date >= "2022-03-01" && date <= "2022-04-15") ||
      (weekday >= 1 && weekday <= 4)
        ? 4
        : 0,
    languages: [
      language("TypeScript", 0.45),
      language("Python", 0.25),
      language("Go", 0.15),
      language("Rust", 0.1),
      language("Other", 0.05),
    ],
    reviews: 120,
    pullRequests: 40,
  },
  grace: {
    years: [2020, 2021, 2022, 2023],
    count: (_date, weekday) => (weekday === 0 || weekday === 6 ? 7 : 0),
    languages: [
      language("Python", 0.55),
      language("Jupyter Notebook", 0.2),
      language("TypeScript", 0.15),
      language("Shell", 0.1),
    ],
    reviews: 10,
    pullRequests: 12,
  },
  linus: {
    years: [2022, 2023],
    count: (date) => (Number(date.slice(8)) % 2 === 0 ? 2 : 0),
    languages: [language("C", 0.7), language("TypeScript", 0.3)],
    reviews: 5,
    pullRequests: 90,
  },
  margaret: {
    years: [2022, 2023],
    count: (_date, weekday) => (weekday === 3 ? 9 : 0),
    languages: [],
    reviews: 0,
    pullRequests: 0,
  },
  [LONG_A]: {
    years: [2021, 2022, 2023],
    // Eight digits in total, and no public code.
    count: (date) => (Number(date.slice(8)) % 2 === 0 ? 30_000 : 0),
    languages: [],
    reviews: 1_200_000,
    pullRequests: 800_000,
    privateContributions: 1_234_567,
  },
  [LONG_B]: {
    years: [2023],
    // One active year, eight digits, long language names.
    count: (_date, weekday) => (weekday >= 1 && weekday <= 5 ? 120_000 : 0),
    languages: [
      language("Jupyter Notebook", 0.4),
      language("Objective-C++", 0.3),
      language("Vim Script", 0.2),
      language("Other", 0.1),
    ],
    reviews: 3,
    pullRequests: 3_000_000,
  },
  "a-very-long-github-login-of-thirty-nine": {
    years: [2023],
    count: (_date, weekday) => (weekday === 5 ? 3 : 1),
    languages: [language("Elixir", 0.8), language("Other", 0.2)],
    reviews: 3,
    pullRequests: 3,
  },
};

function historyFor(login: string) {
  const profile = PROFILES[login] ?? {
    years: [2023],
    count: () => 1,
    languages: [],
    reviews: 0,
    pullRequests: 0,
  };
  const history = makeHistory(
    login,
    profile.years.map((year) =>
      makeYear(year, daysOf(year, profile.count), {
        privateContributions: profile.privateContributions ?? 0,
      }),
    ),
  );
  return {
    ...history,
    languages: profile.languages,
    totals: {
      ...history.totals,
      reviews: profile.reviews,
      pullRequests: profile.pullRequests,
    },
  };
}

async function mockHistories(page: Page) {
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: historyFor(login),
      },
    });
  });
}

const SCENES = [
  { name: "Favorite languages of each developer", next: /Longest streaks/ },
  { name: "Longest streaks of each developer", next: /Rhythm sync/ },
  { name: "Weekday shares of each developer", next: /Awards/ },
  { name: "Awards", next: /Finale/ },
] as const;

async function start(page: Page, logins: string[]) {
  // Everything is revealed from the first frame, so every box can be measured.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockHistories(page);
  await page.goto(`/${logins.join("/")}`);
  await play(page).click();
  // Scenes 1 to 3 (arrival, race, shared days) come first; stop on the last.
  await expect(
    page.getByRole("region", { name: /^When each developer joined/ }),
  ).toBeVisible();
  await next(page).click();
  await expect(
    page.getByRole("region", { name: /^Cumulative contributions/ }),
  ).toBeVisible();
  await next(page).click();
  await expect(
    page.getByRole("region", { name: /^Shared days/ }),
  ).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test(`versus scenes 4 to 8 fit at ${viewport.name} with three developers`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await start(page, ["ada", "grace", "linus"]);

    for (const scene of SCENES) {
      await next(page).click();
      const region = page.getByRole("region", { name: scene.name });
      await expect(region).toBeVisible();
      await expect(next(page)).toHaveAccessibleName(scene.next);
      // Content waits for its beat; the layout is the same hidden or shown.
      // The streak blocks are data marks sized by their days, not tap buttons.
      await expectSceneFits(page, {
        tapTargets: !scene.name.startsWith("Longest streaks"),
      });
    }

    await next(page).click();
    const poster = page.getByRole("region", { name: "Versus summary" });
    await expect(poster).toBeVisible();
    await expectSceneFits(page, { tapTargets: true });
  });
}

for (const viewport of VIEWPORTS) {
  test(`versus scenes never overflow sideways at ${viewport.name} with five developers`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await start(page, [
      "ada",
      "grace",
      "linus",
      "margaret",
      "a-very-long-github-login-of-thirty-nine",
    ]);

    for (const scene of SCENES) {
      await next(page).click();
      const region = page.getByRole("region", { name: scene.name });
      await expect(region).toBeVisible();
      // The streak blocks are data marks sized by their days, not tap buttons.
      await expectSceneFits(page, {
        tapTargets: !scene.name.startsWith("Longest streaks"),
      });
    }

    await next(page).click();
    const poster = page.getByRole("region", { name: "Versus summary" });
    await expect(poster).toBeVisible();
    await expectSceneFits(page, { tapTargets: true });
  });
}

for (const viewport of VIEWPORTS) {
  test(`stress: long logins, eight-digit totals, no languages, one year at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await start(page, [LONG_A, LONG_B]);

    for (const scene of SCENES) {
      await next(page).click();
      const region = page.getByRole("region", { name: scene.name });
      // Without public code for one of them the languages scene still plays.
      await expect(region).toBeVisible();
      // The streak blocks are data marks sized by their days, not tap buttons.
      await expectSceneFits(page, {
        tapTargets: !scene.name.startsWith("Longest streaks"),
      });
    }
    await next(page).click();
    const poster = page.getByRole("region", { name: "Versus summary" });
    await expect(poster).toContainText("Includes shared private contributions");
    await expectSceneFits(page, { tapTargets: true });
  });
}

test("the scenes describe habits and never rank", async ({ page }) => {
  await start(page, ["ada", "grace", "linus"]);

  await next(page).click();
  const languages = page.getByRole("region", {
    name: "Favorite languages of each developer",
  });
  await expect(languages).toContainText("TypeScript");
  await expect(languages).toContainText("TypeScript shows up for all 3.");
  await expect(languages).toContainText("Only @ada has Go");

  await next(page).click();
  const streaks = page.getByRole("region", {
    name: "Longest streaks of each developer",
  });
  await expect(streaks).toContainText(
    "@ada kept it going for 47 days in a row.",
  );

  await next(page).click();
  const rhythm = page.getByRole("region", {
    name: "Weekday shares of each developer",
  });
  await expect(rhythm).toContainText("Closest weeks");
  await expect(
    rhythm.getByRole("img", { name: /^Monday: @ada \d+%, @grace \d+%/ }),
  ).toBeVisible();

  await next(page).click();
  const awards = page.getByRole("region", { name: "Awards" });
  await expect(awards).toContainText("Longest streak");
  await expect(awards).toContainText("Weekend regular");
  await expect(awards).toContainText("Earliest start");

  await expect(
    page.getByText(/winner|best|most productive|leader|champion|rank/i),
  ).toHaveCount(0);
});

async function openPoster(page: Page) {
  await start(page, ["ada", "grace", "linus"]);
  for (let step = 0; step < SCENES.length + 1; step += 1) {
    await next(page).click();
  }
  const poster = page.getByRole("region", { name: "Versus summary" });
  await expect(poster).toContainText(
    "Contributions are not productivity. This is rhythm, not value.",
  );
  await expect(poster).toContainText("Contributions between three of you.");
  return poster;
}

test("the poster downloads a real image where files cannot be shared", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined });
  });
  const poster = await openPoster(page);
  const save = poster.getByRole("button", { name: "Save image" });

  // The image is drawn ahead of the click; wait for it instead of guessing.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    expect(async () => {
      await save.click();
      await expect(poster.getByRole("status")).not.toContainText("still being");
    }).toPass(),
  ]);
  expect(download.suggestedFilename()).toBe("committed-versus.png");
  const file = readFileSync(await download.path());
  // PNG signature, and a real picture rather than an empty canvas.
  expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(file.length).toBeGreaterThan(20_000);
  await expect(poster.getByRole("status")).toHaveText("Download started.");
});

test("the poster shares the image file when the browser can", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const target = window as unknown as { shared?: string[] };
    Object.defineProperty(navigator, "canShare", { value: () => true });
    Object.defineProperty(navigator, "share", {
      value: async (data: { files?: File[] }) => {
        target.shared = (data.files ?? []).map(
          (file) => `${file.name}|${file.type}|${file.size > 20_000}`,
        );
      },
    });
  });
  const poster = await openPoster(page);
  await expect(async () => {
    await poster.getByRole("button", { name: "Save image" }).click();
    await expect(poster.getByRole("status")).not.toContainText("still being");
  }).toPass();
  await expect(poster.getByRole("status")).toHaveText("Image shared.");
  expect(
    await page.evaluate(
      () => (window as unknown as { shared?: string[] }).shared,
    ),
  ).toEqual(["committed-versus.png|image/png|true"]);
});

test("a lineup without public code skips the languages scene", async ({
  page,
}) => {
  await mockHistories(page);
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: makeHistory(login, [
          makeYear(2023, steadyDays(2023, 2)),
          makeYear(2024, steadyDays(2024, 3)),
        ]),
      },
    });
  });
  await page.goto("/ada/grace");
  await play(page).click();
  // Arrival, race, shared days, then languages is skipped: streaks come next.
  for (let i = 0; i < 3; i++) await next(page).click();
  await expect(
    page.getByRole("region", { name: "Longest streaks of each developer" }),
  ).toBeVisible();
});
