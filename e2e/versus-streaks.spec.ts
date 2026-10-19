import { expect, type Page, test } from "@playwright/test";
import type { DailyContributions } from "../src/domain/types";
import { makeHistory, makeYear } from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const next = (page: Page) => page.getByRole("button", { name: /^Next/ });

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

type Shape = {
  years: number[];
  /** Whether the day is active; everything else is quiet. */
  active: (date: string, weekday: number) => boolean;
};

const LONG_A = "ab".repeat(20).slice(0, 39);
const LONG_B = "cd".repeat(20).slice(0, 39);

const SHAPES: Record<string, Shape> = {
  ada: {
    years: [2021, 2022, 2023],
    active: (date, weekday) =>
      (date >= "2022-03-01" && date <= "2022-04-15") ||
      (weekday >= 1 && weekday <= 4),
  },
  grace: {
    years: [2020, 2021, 2022, 2023],
    active: (_date, weekday) => weekday === 0 || weekday === 6,
  },
  linus: {
    years: [2022, 2023],
    active: (date) => Number(date.slice(8)) % 2 === 0,
  },
  margaret: {
    years: [2022, 2023],
    active: (_date, weekday) => weekday === 3,
  },
  // A run that ends on the very last day of the shared axis.
  edge: {
    years: [2023],
    active: (date) => date >= "2023-12-01",
  },
  [LONG_A]: {
    years: [2021, 2022, 2023],
    active: (date) => Number(date.slice(8)) % 2 === 0,
  },
  [LONG_B]: {
    years: [2023],
    active: (_date, weekday) => weekday >= 1 && weekday <= 5,
  },
};

function daysOf(shape: Shape, year: number): DailyContributions[] {
  const days: DailyContributions[] = [];
  const end = Date.UTC(year, 11, 31);
  for (let ms = Date.UTC(year, 0, 1); ms <= end; ms += 86_400_000) {
    const date = iso(ms);
    if (shape.active(date, new Date(ms).getUTCDay())) {
      days.push({ date, count: 3 });
    }
  }
  return days;
}

async function open(page: Page, logins: string[]) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    const shape = SHAPES[login] ?? SHAPES.ada;
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: makeHistory(
          login,
          (shape?.years ?? [2023]).map((year) =>
            makeYear(year, daysOf(shape as Shape, year)),
          ),
        ),
      },
    });
  });
  await page.goto(`/${logins.join("/")}`);
  await page.getByRole("button", { name: "Play" }).click();
  const region = page.getByRole("region", {
    name: "Longest streaks of each developer",
  });
  for (let step = 0; step < 10; step += 1) {
    if (await region.isVisible()) break;
    await next(page).click();
  }
  await expect(region).toBeVisible();
  return region;
}

for (const viewport of VIEWPORTS) {
  const phone = viewport.width < 768;

  test(`streaks fit at ${viewport.name} with three developers`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page, ["ada", "grace", "linus"]);
    await expectSceneFits(page, { allowScroll: phone });
  });

  test(`streaks fit at ${viewport.name} with five developers`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page, ["ada", "grace", "linus", "margaret", "edge"]);
    // Five phone rows fit without scrolling at 390x844; 360x740 may scroll.
    await expectSceneFits(page, {
      allowScroll: viewport.width < 390 || viewport.width >= 768,
    });
  });

  test(`streaks fit at ${viewport.name} with 39-character logins`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page, [LONG_A, LONG_B]);
    await expectSceneFits(page, { allowScroll: phone });
  });
}

test("hovering a streak names it and dims the other rows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const region = await open(page, ["ada", "grace", "linus"]);

  const streak = region.getByRole("button", { name: /^@ada: .* in a row,/ });
  const quiet = region.getByRole("button", { name: /^@ada: .* quiet,/ });
  await expect(streak).toBeVisible();
  await expect(quiet).toBeVisible();
  const label = (await streak.getAttribute("aria-label")) ?? "";

  await streak.hover();
  const tooltip = region.getByRole("tooltip");
  await expect(tooltip).toContainText(/\d+ days? in a row/i);
  expect(label).toContain(
    (await tooltip.locator("p").nth(1).textContent()) ?? "?",
  );
  const rows = region.getByRole("listitem");
  await expect(rows.nth(0)).toHaveCSS("opacity", "1");
  await expect(rows.nth(1)).toHaveCSS("opacity", "0.45");

  await quiet.focus();
  await expect(tooltip).toContainText(/\d+ days? quiet/i);

  await page.mouse.move(2, 2);
  await quiet.blur();
  await expect(tooltip).toHaveCount(0);
  await expect(rows.nth(1)).toHaveCSS("opacity", "1");
});

test("the tooltip of a streak at the far right stays inside the frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const region = await open(page, ["ada", "grace", "edge"]);
  const streak = region.getByRole("button", { name: /^@edge: .* in a row,/ });
  await streak.hover();
  const tooltip = region.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const frame = await page.locator("[data-scene-frame]").boundingBox();
  const box = await tooltip.boundingBox();
  expect(frame && box).toBeTruthy();
  if (!frame || !box) return;
  expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(frame.y - 1);
});

test("a phone row toggles both date ranges on tap", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const region = await open(page, ["ada", "grace", "edge"]);
  // @grace has both a run and a quiet stretch; @edge never goes quiet.
  const row = region.getByRole("button", { name: /^@grace: .* in a row: /i });
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(row).toContainText(/in a row: .*quiet: /);
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "false");
});
