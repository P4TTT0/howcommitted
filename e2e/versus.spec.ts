import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./fit";

const play = (page: Page) => page.getByRole("button", { name: "Play" });
const nextButton = (page: Page) => page.getByRole("button", { name: /^Next/ });
const prevButton = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });

/** [year, contributions per active day, an active day every N days] */
type Shape = [number, number, number];
type Dataset = { years: Shape[]; createdAt?: string };

const DEFAULT: Dataset = { years: [] };

/** Replies to /api/history/{login}; `blocked` logins hit the anonymous quota. */
async function mockHistory(
  page: Page,
  blocked: string[] = [],
  datasets: Record<string, Dataset> = {},
) {
  const requests: string[] = [];
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    requests.push(login);
    if (blocked.includes(login)) {
      await route.fulfill({
        status: 401,
        json: { error: { code: "login_required", message: "Free runs used." } },
      });
      return;
    }
    const days = login === "ada" ? 2 : 3;
    const dataset = datasets[login] ?? DEFAULT;
    const shapes: Shape[] =
      dataset.years.length > 0
        ? dataset.years
        : [
            [2023, days, 3],
            [2024, days, 3],
          ];
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: makeHistory(
          login,
          shapes.map(([year, count, every]) =>
            makeYear(year, steadyDays(year, count, every)),
          ),
          dataset.createdAt,
        ),
      },
    });
  });
  return requests;
}

/** Ada leads through 2022, then grace (heavier in 2023) passes her. */
const CROSSING: Record<string, Dataset> = {
  ada: {
    years: [
      [2022, 1, 1],
      [2023, 1, 1],
    ],
  },
  grace: { years: [[2023, 3, 1]] },
};

/** One veteran with many years, to stress the year picker and the axis. */
const VETERAN: Record<string, Dataset> = {
  veteran: {
    years: Array.from(
      { length: 17 },
      (_, offset): Shape => [2008 + offset, 2, 4],
    ),
    createdAt: "2008-03-02T00:00:00Z",
  },
};

test("a versus path waits for Play and fetches nothing before it", async ({
  page,
}) => {
  const requests = await mockHistory(page);
  await page.goto("/ada/grace/linus");
  await expect(page.getByRole("heading", { name: "Versus" })).toBeVisible();
  await expect(play(page)).toBeVisible();
  expect(requests).toEqual([]);
});

test("Play loads each history in order, then plays the arrival, the race, the shared days and the finale without ranking", async ({
  page,
}) => {
  const requests = await mockHistory(page);
  await page.goto("/ada/grace/linus");
  await play(page).click();

  // Scene 1: the arrival, one row per developer in the order they were added.
  const arrival = page.getByRole("region", {
    name: /^When each developer joined GitHub/,
  });
  await expect(arrival).toBeVisible();
  expect(requests).toEqual(["ada", "grace", "linus"]);
  const rows = arrival.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("@ada");
  await expect(rows.nth(2)).toContainText("@linus");
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();

  // Scene 2: the race, one lane per developer.
  await nextButton(page).click();
  const race = page.getByRole("region", {
    name: /^Cumulative contributions from 2023 to 2024/,
  });
  await expect(race).toBeVisible();
  await expect(race.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("Lines crossed")).toBeVisible();
  await expect(
    race.getByRole("button", { name: "Calendar years" }),
  ).toBeVisible();
  await expect(race.getByRole("button", { name: "Same age" })).toBeVisible();

  // Scene 3: the shared days.
  await nextButton(page).click();
  await expect(
    page.getByRole("region", { name: "Shared days, 2023 to 2024" }),
  ).toBeVisible();

  // The same controls as solo: Next moves on, scene by scene, to the finale.
  const nextScene = page.getByRole("button", { name: /^Next/ });
  while (await nextScene.isEnabled()) await nextScene.click();
  await expect(
    page.getByText(
      "Contributions are not productivity. This is rhythm, not value.",
    ),
  ).toBeVisible();
  const finale = page.getByRole("region", { name: "Versus summary" });
  await expect(finale).toBeVisible();
  await expect(finale.getByRole("button", { name: "Replay" })).toBeVisible();
  await expect(
    finale.getByRole("link", { name: "Search again" }),
  ).toBeVisible();
  await expect(
    page.getByText("contributions, 2023 to 2024").first(),
  ).toBeVisible();

  await expect(
    page.getByText(/winner|best|most productive|leader/i),
  ).toHaveCount(0);
});

test("it stops at the first login_required and requests nothing more", async ({
  page,
}) => {
  const requests = await mockHistory(page, ["grace"]);
  await page.goto("/ada/grace/linus");
  await play(page).click();
  await expect(page.getByText(/^Free runs used\./)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" }),
  ).toHaveAttribute(
    "href",
    `/api/auth/github?returnTo=${encodeURIComponent("/ada/grace/linus")}`,
  );
  expect(requests).toEqual(["ada", "grace"]);
});

/**
 * Lands on a versus scene in explore without waiting for it to play: leaving
 * a scene counts it as played, so stepping forward to the finale and back
 * reopens the scenes finished.
 */
async function openInExplore(page: Page, sceneNumber: number, count = 3) {
  for (let scene = 1; scene <= count; scene += 1) {
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();
  }
  for (let scene = count; scene >= sceneNumber; scene -= 1) {
    await prevButton(page).click();
  }
}

test("the race orders its bars by the running total, with no ranks, and lists the lines crossed", async ({
  page,
}) => {
  await mockHistory(page, [], CROSSING);
  await page.goto("/ada/grace");
  await play(page).click();
  await expect(
    page.getByRole("region", { name: /^When each developer joined/ }),
  ).toBeVisible();
  await openInExplore(page, 2);

  const race = page.getByRole("region", {
    name: /^Cumulative contributions from 2022 to 2023/,
  });
  await expect(race).toBeVisible();
  const lanes = race.getByRole("listitem").filter({ hasText: "@" });
  const slider = race.getByRole("slider");
  await expect(slider).toBeAttached();

  // Finished: grace has passed ada, so her bar sits first.
  await expect(lanes.nth(0)).toContainText("@grace");
  await expect(lanes.nth(1)).toContainText("@ada");

  // At the start of the axis ada is ahead: the bars swapped places.
  await slider.focus();
  await slider.press("Home");
  await expect(lanes.nth(0)).toContainText("@ada");
  await slider.press("End");
  await expect(lanes.nth(0)).toContainText("@grace");

  // The crossing is named, plainly.
  await expect(race.getByText("@grace passes @ada")).toBeVisible();
  await expect(race.getByText(/#\d|\bfirst place\b|\bwinner\b/i)).toHaveCount(
    0,
  );
});

test("the race toggles to the same age and aligns everyone by their first year", async ({
  page,
}) => {
  await mockHistory(page, [], CROSSING);
  await page.goto("/ada/grace");
  await play(page).click();
  await expect(
    page.getByRole("region", { name: /^When each developer joined/ }),
  ).toBeVisible();
  await openInExplore(page, 2);

  const race = page.getByRole("region", {
    name: /^Cumulative contributions from 2022 to 2023/,
  });
  const calendar = race.getByRole("button", { name: "Calendar years" });
  const sameAge = race.getByRole("button", { name: "Same age" });
  await expect(sameAge).toBeEnabled();
  await expect(calendar).toHaveAttribute("aria-pressed", "true");

  await sameAge.click();
  await expect(sameAge).toHaveAttribute("aria-pressed", "true");
  await expect(calendar).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByText(/Everyone starts at their own first year/),
  ).toBeVisible();

  const slider = race.getByRole("slider");
  await slider.focus();
  await slider.press("Home");
  // Grace's first year is her year 1, like ada's: both are on the axis at once.
  await expect(race.getByText("Year 1", { exact: true }).first()).toBeVisible();
  await expect(race.getByText("Not there yet")).toHaveCount(0);
  await slider.press("End");
  await expect(race.getByText(/^Year \d+$/).first()).toBeVisible();

  await calendar.click();
  await expect(calendar).toHaveAttribute("aria-pressed", "true");
  await slider.press("Home");
  await expect(race.getByText("Not there yet")).toBeVisible();
});

test("shared days splits a day between the developers and reads any day in explore", async ({
  page,
}) => {
  await mockHistory(page);
  await page.goto("/ada/grace/linus");
  await play(page).click();
  await expect(
    page.getByRole("region", { name: /^When each developer joined/ }),
  ).toBeVisible();
  await openInExplore(page, 3);

  const shared = page.getByRole("region", {
    name: "Shared days, 2023 to 2024",
  });
  await expect(shared).toBeVisible();
  await expect(page.getByText("@ada").first()).toBeVisible();
  await expect(shared.getByText("Longest run together")).toBeVisible();

  // Only the layout this screen shows is exposed as the day slider.
  const target = shared.getByRole("slider", { name: /Days of the year/ });
  await target.focus();
  await target.press("Home");
  await expect(shared.getByText("Mon, Jan 1", { exact: true })).toBeVisible();
  await target.press("ArrowRight");
  await expect(shared.getByText("Tue, Jan 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Earlier year" }).click();
  await expect(page.getByText("2023", { exact: true })).toBeVisible();
});

/** The longest possible logins, 8-digit totals, far-apart first years. */
const LONG_A = "ada-".padEnd(39, "a");
const LONG_B = "grace-".padEnd(39, "b");
const STRESS: Record<string, Dataset> = {
  [LONG_A]: { years: [[2008, 100000, 2]], createdAt: "2008-03-02T00:00:00Z" },
  [LONG_B]: {
    years: [
      [2023, 100000, 2],
      [2024, 100000, 2],
    ],
  },
};

const SCENARIOS = [
  {
    name: "five developers",
    path: "/ada/grace/linus/margaret/veteran",
    datasets: VETERAN,
  },
  {
    name: "39-character logins, 8-digit totals, far-apart first years",
    path: `/${LONG_A}/${LONG_B}`,
    datasets: STRESS,
  },
];

for (const viewport of VIEWPORTS) {
  for (const scenario of SCENARIOS) {
    test(`the versus scenes fit with no clipping or sideways scroll at ${viewport.name}: ${scenario.name}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await mockHistory(page, [], scenario.datasets);
      await page.goto(scenario.path);
      await play(page).click();

      const phone = viewport.width < 768;
      const fit = { allowVerticalScroll: phone };

      const arrival = page.getByRole("region", {
        name: /^When each developer joined/,
      });
      await expect(arrival).toBeVisible();
      // Playing, then finished: the layout is the same.
      await expectSceneFits(page, { region: arrival, ...fit });

      await openInExplore(page, 3);
      const shared = page.getByRole("region", {
        name: /^Shared days, 2008 to 2024/,
      });
      await expect(shared).toBeVisible();
      await expectSceneFits(page, { region: shared, ...fit });
      // The earliest year, through the stepper.
      const step = page.getByRole("button", { name: "Earlier year" });
      await expect(step).toBeEnabled();
      await step.click();
      await expectSceneFits(page, { region: shared, ...fit });

      await prevButton(page).click();
      const race = page.getByRole("region", {
        name: /^Cumulative contributions from 2008 to 2024/,
      });
      await expect(race).toBeVisible();
      await expectSceneFits(page, { region: race, ...fit });
      const sameAge = race.getByRole("button", { name: "Same age" });
      await expect(sameAge).toBeEnabled();
      await sameAge.click();
      await expect(sameAge).toHaveAttribute("aria-pressed", "true");
      await expectSceneFits(page, { region: race, ...fit });

      await prevButton(page).click();
      await expect(arrival).toBeVisible();
      await expectSceneFits(page, { region: arrival, ...fit });
    });
  }
}
