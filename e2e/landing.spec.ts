import { expect, test } from "@playwright/test";

const AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='%23141414'/></svg>";

const preview = {
  user: {
    login: "ada",
    name: "Ada Lovelace",
    avatarUrl: AVATAR,
    createdAt: "2022-01-01T00:00:00Z",
    contributionYears: [2024, 2023, 2022],
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/user/*", (route) =>
    route.fulfill({ json: preview }),
  );
  await page.route("**/api/history/*", (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
});

test("the landing is the question, with the input inside the sentence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("How committed", { exact: true })).toBeVisible();
  const input = page.getByRole("textbox", {
    name: "How committed is GitHub username",
  });
  await expect(input).toBeVisible();
  // The small wordmark is the page title; the question is the headline.
  await expect(
    page.getByRole("heading", { level: 1, name: "Committed" }),
  ).toBeVisible();
});

test("typing a username finds the user in a clickable row", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  const row = page.locator("button:visible", { hasText: "Ada Lovelace" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("@ada");
  await expect(row).toContainText("Active 2022–2024");
  await expect(row).toHaveCSS("cursor", "pointer");
});

test("the whole preview row starts the experience", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  await page.locator("button:visible", { hasText: "Ada Lovelace" }).click();
  await expect(page).toHaveURL(/\/ada$/);
});

test("Play has a pointer, and Enter starts when a user is found", async ({
  page,
}) => {
  await page.goto("/");
  const listen = page.getByRole("button", { name: /^Play( @\w+)?$/ }).first();
  await expect(listen).toHaveAttribute("aria-disabled", "true");

  const input = page.getByLabel("GitHub username");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Type a GitHub username first.")).toBeVisible();

  await input.fill("ada");
  await expect(listen).toHaveAttribute("aria-disabled", "false");
  await expect(listen).toHaveCSS("cursor", "pointer");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/ada$/);
});

test("the nav credits the author and links out", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "About" });
  await expect(nav.getByRole("link", { name: "@P4TTT0" })).toHaveAttribute(
    "href",
    "https://github.com/P4TTT0",
  );
  await expect(nav.getByRole("link", { name: "GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/P4TTT0/howcommitted",
  );
  await expect(nav.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/pperezcardenal",
  );
});

test("the placeholder types example usernames", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const input = page.getByLabel("GitHub username");
  await expect
    .poll(async () => (await input.getAttribute("placeholder")) ?? "")
    .not.toBe("torvalds");
});

test("reduced motion keeps a static placeholder and a drawn line", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const input = page.getByLabel("GitHub username");
  await expect(input).toHaveAttribute("placeholder", "torvalds");
  await page.waitForTimeout(700);
  await expect(input).toHaveAttribute("placeholder", "torvalds");
  await expect(page.locator("svg.signature-line")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("the layout holds on a portrait phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the disabled Play stays legible: no opacity, dashed, same size", async ({
  page,
}) => {
  await page.goto("/");
  const listen = page.getByRole("button", { name: /^Play( @\w+)?$/ }).first();
  await expect(listen).toHaveAttribute("aria-disabled", "true");
  await expect(listen).toHaveCSS("opacity", "1");
  await expect(listen).toHaveCSS("border-top-style", "dashed");
  await expect(listen).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(listen).toHaveCSS("color", "rgb(20, 20, 20)");
  await expect(listen).toHaveCSS("cursor", "not-allowed");
  const box = await listen.boundingBox();

  await page.getByLabel("GitHub username").fill("ada");
  await expect(listen).toHaveAttribute("aria-disabled", "false");
  await expect(listen).toHaveCSS("background-color", "rgb(20, 20, 20)");
  await expect(listen).toHaveCSS("color", "rgb(243, 241, 236)");
  const after = await listen.boundingBox();
  expect([after?.width, after?.height]).toEqual([box?.width, box?.height]);
});

test("on a phone the question takes three lines and fits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const how = page.getByText("How", { exact: true });
  const committed = page.getByText("committed", { exact: true });
  const [a, b] = await Promise.all([
    how.boundingBox(),
    committed.boundingBox(),
  ]);
  expect(b?.y ?? 0).toBeGreaterThan((a?.y ?? 0) + (a?.height ?? 0) - 2);
  expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(390 - 16);
});

const VIEWPORTS = [
  [1920, 1080],
  [1536, 730],
  [1366, 768],
  [1280, 720],
  [1440, 900],
  [390, 844],
  [360, 640],
  [844, 390],
  [768, 1024],
] as const;

for (const [width, height] of VIEWPORTS) {
  for (const state of ["empty", "found", "five"] as const) {
    test(`never scrolls and shows everything at ${width}x${height} (${state})`, async ({
      page,
    }) => {
      await page.route("**/api/user/*", (route) => {
        const login = decodeURIComponent(
          new URL(route.request().url()).pathname.split("/").pop() ?? "",
        );
        return route.fulfill({
          json: {
            user: {
              ...preview.user,
              login,
              name: login === "sindresorhus" ? "Sindre Sorhus" : login,
            },
          },
        });
      });
      await page.setViewportSize({ width, height });
      await page.goto("/");
      if (state !== "empty") {
        await page.getByLabel("GitHub username").fill("sindresorhus");
        await expect(
          page.locator("button:visible", { hasText: "Sindre Sorhus" }),
        ).toBeVisible();
      }
      if (state === "five") {
        // The longest logins GitHub allows (39 characters), so pills are as wide as they get.
        for (const rival of ["1", "2", "3", "4"].map(
          (n) => `r${n}${"x".repeat(37)}`,
        )) {
          await page.getByRole("button", { name: "+ vs" }).click();
          await page.getByLabel("Rival login").fill(rival);
          await expect(
            page.locator("#rival-status", { hasText: `Found @${rival}` }),
          ).toBeVisible();
          await page.getByLabel("Rival login").press("Enter");
        }
        await expect(page.getByRole("list", { name: "Rivals" })).toBeVisible();
        await expect(page.getByRole("button", { name: "+ vs" })).toHaveCount(0);
      }

      const scroll = await page.evaluate(() => ({
        h: document.documentElement.scrollHeight - window.innerHeight,
        w: document.documentElement.scrollWidth - window.innerWidth,
        body: document.body.scrollHeight - window.innerHeight,
      }));
      expect(scroll.h).toBeLessThanOrEqual(0);
      expect(scroll.w).toBeLessThanOrEqual(0);

      // Nothing is clipped: every part sits fully inside the viewport.
      const targets = [
        page.locator("form"),
        page.getByRole("button", { name: /^Play( @\w+)?$/ }).first(),
        page.getByRole("heading", { level: 1 }),
        page.getByText("Type a GitHub username.", { exact: false }),
      ];
      if (state !== "empty") {
        targets.push(
          page.locator("button:visible", { hasText: "Sindre Sorhus" }),
        );
      }
      if (state === "five") {
        targets.push(page.getByRole("list", { name: "Rivals" }));
      }
      for (const target of targets) {
        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
        expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
      }
    });
  }
}

test("on a wide landscape screen the found developer is a card on the right", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 730 });
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  const card = page
    .getByRole("button", { name: "Play @ada", exact: false })
    .last();
  await expect(card).toContainText("Ada Lovelace");
  await expect(card).toContainText("@ada");
  await expect(card).toContainText("Active 2022–2024");
  const box = await card.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeGreaterThan(1536 / 2);
  await expect(card).toHaveCSS("cursor", "pointer");
  await card.click();
  await expect(page).toHaveURL(/\/ada$/);
});

test("the right column stays empty until a user is found", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 730 });
  await page.goto("/");
  await expect(page.locator("button:visible", { hasText: "@" })).toHaveCount(0);
  await page.getByLabel("GitHub username").fill("ada");
  await expect(
    page.locator("button:visible", { hasText: "Ada Lovelace" }),
  ).toHaveCount(1);
});

test("on a portrait screen the compact row stays under the question", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await page.getByLabel("GitHub username").fill("ada");
  const row = page.locator("button:visible", { hasText: "Ada Lovelace" });
  await expect(row).toBeVisible();
  const [rowBox, inputBox] = await Promise.all([
    row.boundingBox(),
    page.getByLabel("GitHub username").boundingBox(),
  ]);
  expect(rowBox?.y ?? 0).toBeGreaterThan(
    (inputBox?.y ?? 0) + (inputBox?.height ?? 0),
  );
  expect(rowBox?.x ?? 9999).toBeLessThan(100);
});

test.describe("versus on the landing", () => {
  test.beforeEach(async ({ page }) => {
    // Every login resolves to itself, so rivals differ from the main developer.
    await page.route("**/api/user/*", (route) => {
      const login = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").pop() ?? "",
      );
      return route.fulfill({ json: { user: { ...preview.user, login } } });
    });
  });

  test("+ vs adds rivals after the exact-username lookup, up to five", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("GitHub username").fill("ada");
    await page.getByRole("button", { name: "+ vs" }).click();
    const rival = page.getByLabel("Rival login");
    await rival.fill("grace");
    await expect(
      page.locator("#rival-status", { hasText: "Found @grace" }),
    ).toBeVisible();
    await rival.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("button", { name: "Remove @grace" }),
    ).toBeVisible();
  });

  test("a rival cannot repeat the main developer or be reserved", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByLabel("GitHub username").fill("ada");
    await page.getByRole("button", { name: "+ vs" }).click();
    const rival = page.getByLabel("Rival login");
    await rival.fill("lab");
    await expect(
      page.getByText(/collides with a Committed page/),
    ).toBeVisible();
    await rival.fill("ADA");
    await expect(
      page.locator("#rival-status", { hasText: "Found @ada" }),
    ).toBeVisible();
    await rival.press("Enter");
    await expect(page.getByText("Already in the lineup.")).toBeVisible();
  });

  test("a pill can be removed", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("GitHub username").fill("grace");
    await page.getByRole("button", { name: "+ vs" }).click();
    await page.getByLabel("Rival login").fill("ada");
    await expect(
      page.locator("#rival-status", { hasText: "Found @ada" }),
    ).toBeVisible();
    await page.getByLabel("Rival login").press("Enter");
    await page.getByRole("button", { name: "Remove @ada" }).click();
    await expect(page.getByRole("button", { name: "Remove @ada" })).toHaveCount(
      0,
    );
  });

  test("Play with rivals opens the versus route", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("GitHub username").fill("grace");
    await page.getByRole("button", { name: "+ vs" }).click();
    await page.getByLabel("Rival login").fill("ada");
    await expect(
      page.locator("#rival-status", { hasText: "Found @ada" }),
    ).toBeVisible();
    await page.getByLabel("Rival login").press("Enter");
    await page
      .getByRole("button", { name: /^Play( @\w+)?$/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/grace\/ada$/);
  });
});
