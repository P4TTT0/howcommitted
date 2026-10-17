import type { NextConfig } from "next";
import { isLabEnabled } from "./src/features/experience/labGate";

const nextConfig: NextConfig = {
  // Same gate as isVersusEnabled (it is the lab gate), inlined for the client:
  // the final poster hides "Challenge someone" in production.
  env: { NEXT_PUBLIC_VERSUS: isLabEnabled(process.env) ? "1" : "0" },
  // The share images read their two font files at request time; file tracing
  // cannot see a runtime path, so the routes list them explicitly.
  outputFileTracingIncludes: {
    "/api/og/[login]": ["./src/og/fonts/*.woff"],
    "/opengraph-image": ["./src/og/fonts/*.woff"],
    "/twitter-image": ["./src/og/fonts/*.woff"],
  },
};

export default nextConfig;
