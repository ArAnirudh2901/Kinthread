import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // names used but never declared must fail lint (a removed variable once blanked the WebGL scene at runtime)
  { rules: { "no-undef": "error" } },
  { files: ["runtime/sw.js"], languageOptions: { globals: { __SHELL__: "readonly" } } },   // filled in by postbuild
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
