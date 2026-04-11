// ─── FormTrack embed build ───────────────────────────────────
// Produces a tiny, standalone JS file that businesses drop onto
// their website. Captures attribution on page load and POSTs the
// form submission to FormTrack.
//
//   npm run embed:build          → one-shot
//   npm run embed:watch          → rebuild on change

import { build, context } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const watch = process.argv.includes("--watch");

const common = {
  entryPoints: ["embed/src/index.ts"],
  outfile: "embed/dist/ft.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2018"],
  platform: "browser",
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  banner: {
    js: "/*! FormTrack embed v0.1 — https://formtrack.io */",
  },
};

await mkdir("embed/dist", { recursive: true });

if (watch) {
  const ctx = await context(common);
  await ctx.watch();
  console.log("[embed] watching for changes…");
} else {
  const result = await build({ ...common, metafile: true });
  const size = Object.values(result.metafile.outputs)[0].bytes;
  await writeFile(
    path.join("embed", "dist", ".meta.json"),
    JSON.stringify(result.metafile, null, 2)
  );
  console.log(`[embed] built → embed/dist/ft.js (${(size / 1024).toFixed(2)} KB)`);
}
