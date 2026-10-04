/* global console, document, localStorage */
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const out = "docs/metrics/visual-run";
const browser = await chromium.launch();
const results = [];
try {
  for (const [app, port] of Object.entries({ marionette: 5285, vue: 5281 }))
    for (const [profile, viewport] of Object.entries({
      desktop: { width: 1440, height: 900 },
      mobile: { width: 390, height: 844 },
    })) {
      const context = await browser.newContext({
        viewport,
        timezoneId: "UTC",
        locale: "en-US",
      });
      await context.addInitScript(() =>
        localStorage.setItem("jwtToken", "visual-fixture"),
      );
      await context.route("**/*", (route) =>
        route.request().url().startsWith("http://127.0.0.1:")
          ? route.continue()
          : route.abort(),
      );
      await context.route("**/api/user", (route) =>
        route.fulfill({
          json: {
            user: {
              username: "writer",
              email: "writer@example.test",
              bio: "Benchmark author",
              image: "http://127.0.0.1:5280/avatar.svg",
              token: "visual-fixture",
            },
          },
        }),
      );
      const page = await context.newPage();
      for (const [name, path, selector] of [
        ["editor", "/editor/article-1", "textarea"],
        ["settings", "/settings", "input[type=password]"],
      ]) {
        try {
          await page.goto(`http://127.0.0.1:${port}${path}`, {
            waitUntil: "networkidle",
          });
          await page.locator(selector).first().waitFor();
          await page.screenshot({
            path: `${out}/${app}-${profile}-${name}.png`,
            fullPage: true,
          });
          results.push({
            app,
            profile,
            page: name,
            screenshot: `${app}-${profile}-${name}.png`,
          });
        } catch (e) {
          results.push({ app, profile, page: name, error: String(e) });
        }
      }
      await context.close();
      console.log(app, profile, "authenticated complete");
    }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const requests = [];
  page.on("requestfailed", (r) =>
    requests.push({ url: r.url(), error: r.failure() }),
  );
  await page.goto("http://127.0.0.1:5285/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${out}/marionette-desktop-home-external-resources.png`,
  });
  const fonts = await page.evaluate(() =>
    [...document.fonts].map((f) => ({ family: f.family, status: f.status })),
  );
  results.push({
    page: "marionette-external-resources",
    fonts,
    failedRequests: requests,
  });
  await context.close();
} finally {
  await browser.close();
}
await writeFile(
  `${out}/auth-results.json`,
  JSON.stringify({ results }, null, 2),
);
