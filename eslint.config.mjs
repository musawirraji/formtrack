// eslint-config-next 16 ships native ESLint flat config arrays — no
// FlatCompat needed. The /core-web-vitals subpath bundles the base
// config + the core-web-vitals strict rules. /typescript adds the
// TS-specific parser + rules on top.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      // App Router root layout.tsx is the correct place for <link> fonts
      // — the rule was designed for the Pages Router _document pattern.
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    ignores: ["embed/dist/**", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
