import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // "server-only" throws outside the Next.js server bundle; tests run in plain Node.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./vitest.server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
