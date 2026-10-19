import { expect, type Page, test } from "@playwright/test";
import {
  makeHistory,
  makeYear,
  steadyDays,
} from "../src/test-support/historyFixture";
import { expectSceneFits, VIEWPORTS } from "./support/fit";

const play = (page: Page) => page.getByRole("button", { name: "Play" });
const next = (page: Page) => page.getByRole("button", { name: /^Next/ });

const language = (name: string, share: number) => ({
  name,
  size: share * 10_000,
  share,
  isOther: name === "Other",
});

const LANGUAGES: Record<string, ReturnType<typeof language>[]> = {
  ada: [
    language("TypeScript", 0.64),
    language("Go", 0.21),
    language("CSS", 0.09),
    language("Shell", 0.04),
    language("Other", 0.02),
  ],
  lin: [
    language("TypeScript", 0.58),
    language("Rust", 0.3),
    language("Python", 0.08),
    language("Other", 0.04),
  ],
  mo: [],
  jo: [
    language("Jupyter Notebook", 0.5),
    language("Objective-C++", 0.3),
    language("Vim Script", 0.2),
  ],
  ed: [language("Elixir", 0.8), language("Other", 0.2)],
  bo: [language("C", 0.7), language("Go", 0.3)],
};

async function openLanguages(page: Page, logins: string[]) {
  // Everything is revealed from the first frame, so every box can be measured.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/history/*", async (route) => {
    const login = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").pop() ?? "",
    );
    await route.fulfill({
      json: {
        source: "cache",
        reposTruncated: false,
        history: {
          ...makeHistory(login, [makeYear(2023, steadyDays(2023, 2, 3))]),
          languages: LANGUAGES[login] ?? [],
        },
      },
    });
  });
  await page.goto(`/${logins.join("/")}`);
  await play(page).click();
  // Walk forward until the scene shows, so the lineup order can change.
  const region = page.getByRole("region", {
    name: "Favorite languages of each developer",
  });
  for (let step = 0; step < 10; step += 1) {
    if (await region.isVisible()) break;
    await next(page).click();
  }
  await expect(region).toBeVisible();
  return region;
}

const LINEUPS = [
  { name: "three developers", logins: ["ada", "lin", "mo"] },
  { name: "five developers", logins: ["ada", "lin", "mo", "jo", "ed"] },
  { name: "long language names", logins: ["jo", "ed", "bo"] },
];

for (const viewport of VIEWPORTS) {
  for (const lineup of LINEUPS) {
    test(`languages fit at ${viewport.name} with ${lineup.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const region = await openLanguages(page, lineup.logins);
      await expectSceneFits(page, {
        tapTargets: true,
        allowScroll: viewport.width < 768,
      });

      if (viewport.width >= 768) {
        const boxes = await region
          .locator("ul > li[data-reveal]")
          .evaluateAll((cards) =>
            cards.map((card) => {
              const { width, height } = card.getBoundingClientRect();
              return [Math.round(width), Math.round(height)];
            }),
          );
        expect(boxes).toHaveLength(lineup.logins.length);
        for (const box of boxes) expect(box).toEqual(boxes[0]);
      }
    });
  }
}

test("a developer without public code gets the same card with an em dash", async ({
  page,
}) => {
  const region = await openLanguages(page, ["ada", "lin", "mo"]);
  const empty = region.locator("ul > li[data-reveal]").filter({
    hasText: "@mo",
  });
  await expect(empty).toContainText("—");
  await expect(empty).toContainText("No public repositories");
  await expect(empty.getByRole("listitem")).toHaveCount(0);
  await expect(region.getByText("64% of their public code")).toBeVisible();
});

test("the scope note is a description and the insight is the band", async ({
  page,
}) => {
  const region = await openLanguages(page, ["ada", "lin"]);
  await expect(region).toHaveAccessibleDescription(
    "Languages of each developer's own public repositories, by code size.",
  );
  await expect(page.getByText("TypeScript shows up for both.")).toBeVisible();
});
