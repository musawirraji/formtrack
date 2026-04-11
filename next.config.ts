import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  sassOptions: {
    // `loadPaths` is the modern Dart Sass name; `includePaths` is the
    // legacy sass-loader alias. Providing both keeps webpack builds
    // and Turbopack happy without ambiguity.
    loadPaths: [path.join(process.cwd(), "src", "shared", "design")],
    includePaths: [path.join(process.cwd(), "src", "shared", "design")],
    // `additionalData` is the modern name; `prependData` is the legacy
    // alias. Next 16 + Turbopack reads `additionalData`; webpack-era
    // sass-loader reads `prependData`.
    additionalData: `@use "_tokens" as *;\n@use "_mixins" as *;\n`,
    prependData: `@use "_tokens" as *;\n@use "_mixins" as *;\n`,
  },

  async headers() {
    return [
      {
        // Security headers on every route
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Embed script must be CORS-open so any site can load it
        source: "/embed/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=300" },
        ],
      },
    ];
  },
};

export default config;
