import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const next = (page: Page) => page.getByRole("button", { name: /^Next/ });

/** 39 characters, one unbreakable word: the worst a login can do to a layout. */
const LONG_A = "ab".repeat(20).slice(0, 39);
const LONG_B = "cd".repeat(20).slice(0, 39);

/** Busy logins get eight-digit totals; the rest stay small. */
const BIG = new Set([LONG_A, LONG_B]);

async function mockHistories(page: Page) {
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    const big = BIG.has(login);
    const year = (y: number) =>
      makeYear(y, steadyDays(y, big ? 30_000 : 3, big ? 2 : 3), {
        privateContributions: big ? 1_000 : 0,
      });
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: makeHistory(login, [year(2022), year(2023)]),
      },
    });
  });
  // The avatars are not under test and must not need the network.
  await page.route("https://github.com/*.png*", (route) => route.abort());
}

async function openPoster(page: Page, logins: string[]) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockHistories(page);
  await page.goto(`/${logins.join("/")}`);
  await page.getByRole("button", { name: "Play" }).click();
  // Wait for the first scene, then walk forward, so the lineup order can change.
  await expect(next(page)).toBeVisible();
  const poster = page.getByRole("region", { name: "Versus summary" });
  for (let step = 0; step < 12; step += 1) {
    if (await poster.isVisible()) break;
    await next(page).click();
  }
  await expect(poster).toBeVisible();
  return poster;
}

const SETS: { name: string; logins: string[] }[] = [
  { name: "two developers", logins: ["ada", "grace"] },
  { name: "three developers", logins: ["ada", "grace", "linus"] },
  {
    name: "five developers",
    logins: ["ada", "grace", "linus", "margaret", "hopper"],
  },
  { name: "long logins and eight-digit totals", logins: [LONG_A, LONG_B] },
  {
    name: "five developers with long logins and eight-digit totals",
    logins: [LONG_A, LONG_B, "ada", "grace", "linus"],
  },
];

for (const viewport of VIEWPORTS) {
  for (const set of SETS) {
    test(`the poster fits at ${viewport.name} with ${set.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const poster = await openPoster(page, set.logins);
      await expectSceneFits(page, {
        tapTargets: true,
        allowScroll: viewport.width < 768,
      });

      await expect(poster.locator("[data-role=dev-band]")).toHaveCount(
        set.logins.length,
      );
      for (const name of ["Together", "Race", "Habits"]) {
        await expect(
          poster.getByRole("button", { name: `${name} card` }),
        ).toBeVisible();
      }
    });
  }
}

test("the poster reads as the approved design", async ({ page }) => {
  const poster = await openPoster(page, ["ada", "grace", "linus"]);
  await expect(poster).toContainText(
    /@ada vs @grace vs @linus · \d{4} — \d{4}/,
  );
  await expect(poster).toContainText("Contributions, together.");
  await expect(poster).toContainText(
    "Contributions are not productivity. This is rhythm, not value.",
  );
  await expect(poster).toContainText(/\d contributions · \d{4} to \d{4}/);
  await expect(poster.getByText("Take it with you")).toBeVisible();
  await expect(
    poster.getByRole("button", { name: "Save together image" }),
  ).toBeVisible();
  await poster.getByRole("button", { name: "Race card" }).click();
  await expect(
    poster.getByRole("button", { name: "Save race image" }),
  ).toBeVisible();
  await expect(poster.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(poster.getByRole("button", { name: "Replay" })).toBeVisible();
  await expect(
    poster.getByRole("link", { name: "Search again" }),
  ).toBeVisible();
  // Nobody shared private contributions here: no note at all.
  await expect(poster).not.toContainText("private");
});

test("saving the selected card downloads a 1080x1920 PNG", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined });
  });
  const poster = await openPoster(page, ["ada", "grace", "linus"]);
  for (const name of ["Together", "Race", "Habits"]) {
    await poster.getByRole("button", { name: `${name} card` }).click();
    const save = poster.getByRole("button", {
      name: `Save ${name.toLowerCase()} image`,
    });
    await expect(save).toBeEnabled();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      save.click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      `committed-ada-vs-grace-vs-linus-${name.toLowerCase()}.png`,
    );
    const file = readFileSync(await download.path());
    expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // IHDR: width and height as big-endian 32-bit integers.
    expect(file.readUInt32BE(16)).toBe(1080);
    expect(file.readUInt32BE(20)).toBe(1920);
  }
});

test("the poster shows the shared private count once", async ({ page }) => {
  const poster = await openPoster(page, [LONG_A, LONG_B]);
  await expect(poster).toContainText(/Includes [\d,]+ private/);
});
