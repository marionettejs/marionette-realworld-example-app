import js from "@eslint/js";
import ts from "typescript-eslint";
import marionette from "marionette/eslint";
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "public/**",
      "realworld/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  { ...marionette.configs.recommended, files: ["src/**/*.ts"] },
  {
    files: ["**/*.{ts,mjs}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
