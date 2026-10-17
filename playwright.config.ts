import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: "http://localhost:3000",
    env: {
      ALLOW_LAB: "1",
      // Dummy values: the sign-in start and the state check never call GitHub.
      AUTH_COOKIE_SECRET: "e2e-auth-cookie-secret-0123456789abcdef",
      GITHUB_OAUTH_CLIENT_ID: "e2e-client-id",
      GITHUB_OAUTH_CLIENT_SECRET: "e2e-client-secret",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
