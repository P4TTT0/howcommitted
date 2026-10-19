import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const play = (page: Page) => page.getByRole("button", { name: "Play" });
const next = (page: Page) => page.getByRole("button", { name: /^Next/ });
const previous = (page: Page) =>
  page.getByRole("button", { name: "Previous scene" });

/** [year, contributions per active day, an active day every N days] */
type Shape = [number, number, number];
type Dataset = Record<string, Shape[]>;

async function mockHistories(page: Page, datasets: Dataset) {
  // Pictures come from github.com: keep the tests offline and deterministic.
  await page.route("https://github.com/**", (route) => route.abort());
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    const shapes = datasets[login] ?? [[2023, 2, 3]];
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: makeHistory(
          login,
          shapes.map(([year, count, every]) =>
            makeYear(year, steadyDays(year, count, every)),
          ),
        ),
      },
    });
  });
}

/** Reduced motion: rows jump to their place, so positions can be read at once. */
async function openRace(page: Page, path: string, datasets: Dataset) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockHistories(page, datasets);
  await page.goto(path);
  await play(page).click();
  const race = page.getByRole("region", { name: /^Cumulative contributions/ });
  await expect(race).toBeVisible();
  return race;
}

/** Steps forward and back so the race reopens finished, in explore. */
async function toExplore(page: Page) {
  await expect(next(page)).toBeEnabled();
  await next(page).click();
  await previous(page).click();
}

/** Ada leads through 2022, then grace (3 a day) passes her in mid 2023. */
const PASS: Dataset = {
  ada: [
    [2022, 1, 1],
    [2023, 1, 1],
  ],
  grace: [[2023, 3, 1]],
  linus: [
    [2022, 1, 2],
    [2023, 1, 2],
  ],
};

/** Walks a week at a time from the start of 2023 to the first announced pass. */
async function walkToPass(page: Page, slider: Locator, match = "passes") {
  await slider.focus();
  await slider.press("Home");
  await slider.press("PageDown");
  const chip = page.locator('[data-role="pass"]');
  for (let step = 0; step < 60; step += 1) {
    if (
      (await chip.isVisible()) &&
      (await chip.innerText()).toLowerCase().includes(match)
    )
      return;
    await slider.press("ArrowRight");
  }
  throw new Error("no pass was announced");
}

const rank = (race: Locator, login: string) =>
  race.locator(`li[data-login="${login}"]`).getAttribute("data-rank");

test("a mid-year pass shows the chip and swaps the rows", async ({ page }) => {
  const race = await openRace(page, "/ada/grace/linus", PASS);
  await toExplore(page);
  const slider = race.getByRole("slider");
  const chip = page.locator('[data-role="pass"]');
  const row = (login: string) => race.locator(`li[data-login="${login}"]`);

  await slider.focus();
  await slider.press("Home");
  await slider.press("PageDown");
  // New year, nobody has passed anyone since the start: ada is ahead.
  await expect(chip).toBeHidden();
  expect(await rank(race, "ada")).toBe("0");

  await walkToPass(page, slider, "passes @ada");
  await expect(chip).toContainText("@grace passes @ada");
  expect(await rank(race, "grace")).toBe("0");
  expect(await rank(race, "ada")).toBe("1");
  // The row really moved: grace's row sits above ada's.
  await expect
    .poll(async () => {
      const grace = await row("grace").boundingBox();
      const ada = await row("ada").boundingBox();
      return (grace?.y ?? 1) < (ada?.y ?? 0);
    })
    .toBe(true);
  // The passer's bar is outlined for the moment of the pass.
  await expect(race.locator('[data-lane-bar="1"]')).toHaveAttribute(
    "data-passing",
    "",
  );
  await expect(race.locator('[data-role="passes"]')).toHaveText("2 passes");

  // Three weeks later the chip is gone and the rows stay where they are.
  for (let step = 0; step < 3; step += 1) await slider.press("ArrowRight");
  await expect(chip).toBeHidden();
  expect(await rank(race, "grace")).toBe("0");

  await expect(race.getByText(/#\d|\bfirst place\b|\bwinner\b/i)).toHaveCount(
    0,
  );
});

test("each row keeps its own node while the order changes", async ({
  page,
}) => {
  const race = await openRace(page, "/ada/grace", PASS);
  await toExplore(page);
  const rows = race.getByRole("listitem");
  const logins = () => rows.evaluateAll((nodes) => nodes.map((n) => n.id));
  await rows.evaluateAll((nodes) => {
    nodes.forEach((node, index) => {
      node.id = `row-${index}`;
    });
  });
  const before = await logins();
  const slider = race.getByRole("slider");
  await slider.focus();
  await slider.press("Home");
  await slider.press("End");
  expect(await logins()).toEqual(before);
  expect(await rank(race, "grace")).toBe("0");
});

test("the years of the timeline jump the race to that year", async ({
  page,
}) => {
  const race = await openRace(page, "/ada/grace", PASS);
  const years = race.locator('[data-role="years"] button');
  // Locked while it plays; alive once it has ended.
  await expect(years.first()).toBeDisabled();
  await toExplore(page);
  await expect(years.first()).toBeEnabled();

  await race.getByRole("button", { name: "Jump to 2022" }).click();
  await expect(page.locator('[data-role="year"]')).toHaveText("2022");
  expect(await rank(race, "ada")).toBe("0");
  await race.getByRole("button", { name: "Jump to 2023" }).click();
  await expect(page.locator('[data-role="year"]')).toHaveText("2023");
});

test("a picture that does not load falls back to the initial in the developer's color", async ({
  page,
}) => {
  const race = await openRace(page, "/ada/grace", PASS);
  const images = race.locator("img[data-avatar]");
  await expect(images.first()).toHaveAttribute(
    "src",
    "https://github.com/ada.png?size=96",
  );
  // The requests are aborted: every picture steps aside for its initial.
  await expect(images.first()).toBeHidden();
  await expect(images.nth(1)).toBeHidden();
  await expect(race.getByText("A", { exact: true })).toBeVisible();
  await expect(race.getByText("G", { exact: true })).toBeVisible();
});

/** The longest possible logins, 8-digit totals and a pass between them. */
const LONG_A = "ada-".padEnd(39, "a");
const LONG_B = "grace-".padEnd(39, "b");
const STRESS: Dataset = {
  [LONG_A]: [
    [2022, 100_000, 1],
    [2023, 100_000, 1],
  ],
  [LONG_B]: [[2023, 300_000, 1]],
};

const SCENARIOS = [
  {
    name: "three developers",
    path: "/ada/grace/linus",
    datasets: PASS,
    scroll: false,
  },
  {
    name: "39-character logins and 8-digit totals",
    path: `/${LONG_A}/${LONG_B}`,
    datasets: STRESS,
    scroll: false,
  },
  {
    name: "five developers",
    path: "/ada/grace/linus/margaret/veteran",
    datasets: PASS,
    // Four or five rows may scroll on a phone; the last one stays reachable.
    scroll: true,
  },
] as const;

for (const viewport of VIEWPORTS) {
  for (const scenario of SCENARIOS) {
    test(`the race fits at ${viewport.name}: ${scenario.name}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize(viewport);
      const race = await openRace(page, scenario.path, scenario.datasets);
      const fit = { allowScroll: scenario.scroll };

      // Playing, then finished, then at the moment of a pass.
      await expectSceneFits(page, fit);
      await toExplore(page);
      await expectSceneFits(page, fit);

      if (scenario.name !== "five developers") {
        await walkToPass(page, race.getByRole("slider"));
        await expect(page.locator('[data-role="pass"]')).toBeVisible();
        await expectSceneFits(page, fit);
      }
    });
  }
}
