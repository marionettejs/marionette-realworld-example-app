import { defineConfig } from "@playwright/test";
import process from "node:process";
import { baseConfig } from "./realworld/specs/e2e/playwright.base";

export default defineConfig({
  ...baseConfig,
  testDir: "./realworld/specs/e2e",
  outputDir: "./test-results/official-realworld",
  use: { ...baseConfig.use, baseURL: "http://127.0.0.1:5174" },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    env: {
      VITE_API_URL: process.env.API_BASE || "https://api.realworld.show/api",
    },
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
