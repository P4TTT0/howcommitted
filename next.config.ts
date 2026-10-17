import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The share images read their two font files at request time; file tracing
  // cannot see a runtime path, so the routes list them explicitly.
  outputFileTracingIncludes: {
    "/api/og/[login]": ["./src/og/fonts/*.woff"],
    "/opengraph-image": ["./src/og/fonts/*.woff"],
    "/twitter-image": ["./src/og/fonts/*.woff"],
  },
};

export default nextConfig;
