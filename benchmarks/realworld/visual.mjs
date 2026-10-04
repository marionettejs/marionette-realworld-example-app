/* global console, URL, document, getComputedStyle, innerWidth, process */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "docs/metrics/visual-run";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [app, port] of Object.entries({
    marionette: 5285,
    vue: 5281,
    react: 5282,
    angular: 5283,
    svelte: 5284,
  })) {
    if (
      process.env.VISUAL_APPS &&
      !process.env.VISUAL_APPS.split(",").includes(app)
    )
      continue;
    for (const [profile, viewport] of Object.entries({
      desktop: { width: 1440, height: 900 },
      mobile: { width: 390, height: 844 },
    })) {
      const context = await browser.newContext({
        viewport,
        timezoneId: "UTC",
        locale: "en-US",
        deviceScaleFactor: 1,
      });
      // Controlled fallback-font comparison: remove external dependency/network variability.
      if (!process.env.VISUAL_EXTERNAL)
        await context.route("**/*", (route) =>
          new URL(route.request().url()).hostname === "127.0.0.1"
            ? route.continue()
            : route.abort(),
        );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      for (const [name, path, selector] of [
        ["home", "/", ".article-preview .preview-link"],
        ["article", "/article/article-1", ".card-text"],
        ["profile", "/profile/writer", ".article-preview .preview-link"],
        ["login", "/login", "input[type=password]"],
        ["register", "/register", "input[type=password]"],
      ]) {
        try {
          await page.goto(
            `http://127.0.0.1:${port}${app === "svelte" && name === "profile" ? "/profile/@writer" : path}`,
            { waitUntil: "networkidle" },
          );
          await page.locator(selector).first().waitFor({ timeout: 15000 });
          await page.evaluate(() => document.fonts.ready);
          const metrics = await page.evaluate(() => {
            const measure = (selector) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const r = el.getBoundingClientRect(),
                s = getComputedStyle(el);
              return {
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
                font: s.fontFamily,
                fontSize: s.fontSize,
                lineHeight: s.lineHeight,
                color: s.color,
              };
            };
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              viewportWidth: innerWidth,
              scrollWidth: document.documentElement.scrollWidth,
              elements: Object.fromEntries(
                [
                  ".navbar",
                  ".banner",
                  ".page",
                  ".article-preview",
                  ".article-meta",
                  ".article-content",
                  ".comment-form",
                  ".user-info",
                  "input[type=email]",
                  "input[type=password]",
                  "footer",
                ].map((s) => [s, measure(s)]),
              ),
            };
          });
          const screenshot = `${process.env.VISUAL_EXTERNAL ? "external-" : ""}${app}-${profile}-${name}.png`;
          await page.screenshot({
            path: `${out}/${screenshot}`,
            fullPage: true,
          });
          results.push({
            app,
            profile,
            page: name,
            path,
            screenshot,
            ...metrics,
            errors: [...errors],
          });
        } catch (error) {
          results.push({ app, profile, page: name, error: String(error) });
        }
      }
      await context.close();
      console.log(app, profile, "complete");
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  `${out}/${process.env.VISUAL_EXTERNAL ? "external-results" : process.env.VISUAL_APPS ? "svelte-results" : "results"}.json`,
  JSON.stringify(
    {
      browser: browser.version(),
      externalResources: process.env.VISUAL_EXTERNAL
        ? "allowed; normal font/icon resources"
        : "blocked; fallback fonts and icons",
      results,
    },
    null,
    2,
  ),
);
