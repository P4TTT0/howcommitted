import { expect, test } from "@playwright/test";

test("a user's share image is a PNG served without calling GitHub", async ({
  request,
}) => {
  const response = await request.get("/api/og/octocat");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  // Short-lived and shared-cache friendly, so crawlers do not hammer Redis.
  expect(response.headers()["cache-control"]).toContain("s-maxage");
  expect((await response.body()).length).toBeGreaterThan(1000);
});

test("invalid and reserved logins get the generic image, not an error", async ({
  request,
}) => {
  for (const login of ["-bad", "lab"]) {
    const response = await request.get(`/api/og/${login}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("a user page points its share tags at the image route", async ({
  page,
}) => {
  await page.goto("/octocat");
  const image = page.locator('meta[property="og:image"]');
  await expect(image).toHaveAttribute("content", /\/api\/og\/octocat$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
});

test("the landing has a site-level share image", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/opengraph-image/,
  );
});
