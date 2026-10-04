import { defineConfig, devices } from "@playwright/test";
const production = process.env.TEST_PRODUCTION === "1";
export default defineConfig({
  testIgnore: production ? "**/lifecycle.spec.ts" : [],
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: production
      ? "npm run build && npm run preview -- --port 5173 --strictPort"
      : "npm run dev -- --port 5173 --strictPort",
    env: { VITE_API_URL: "http://127.0.0.1:5173/api" },
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
  },
});
