/* global URL, console, document, getComputedStyle, innerWidth, localStorage */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  chromium,
  expect,
} from "../../../node_modules/@playwright/test/index.mjs";
const out = new URL(".", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
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
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://127.0.0.1:5285/", { waitUntil: "networkidle" });
    await page.locator(".article-preview .author").first().click();
    await expect(page.locator(".user-info h4")).toHaveText("writer");
    await expect(page.locator(".user-info h4")).toBeFocused();
    await expect(page).toHaveTitle("writer — Conduit");
    await page.evaluate(() => document.fonts.ready);
    const heading = await page.locator(".user-info h4").evaluate((el) => ({
      fontSize: getComputedStyle(el).fontSize,
      fontWeight: getComputedStyle(el).fontWeight,
      tag: el.tagName,
    }));
    const header = await page.locator(".user-info").boundingBox();
    await page.screenshot({ path: `${out}/detail-${profile}-profile.png` });
    results.push({
      profile,
      page: "profile",
      heading,
      header,
      focusAndTitle: true,
    });
    await page.goto("http://127.0.0.1:5285/article/article-1", {
      waitUntil: "networkidle",
    });
    await expect(
      page.locator(".article-content .col-md-12 > ul.tag-list a"),
    ).toHaveCount(2);
    const tag = page.locator(".article-content .tag-list a").first();
    assert.equal(
      await tag.evaluate((el) => getComputedStyle(el).color),
      "rgb(170, 170, 170)",
    );
    await tag.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${out}/detail-${profile}-article-tags.png`,
    });
    const tags = await page.locator(".article-content .tag-list").boundingBox();
    await tag.click();
    await expect(page.locator(".feed-toggle .active")).toHaveText(/javascript/);
    results.push({
      profile,
      page: "article",
      tags,
      tagColor: "rgb(170, 170, 170)",
      tagNavigation: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    for (const external of [false, true]) {
      const context = await browser.newContext({
        viewport,
        timezoneId: "UTC",
        locale: "en-US",
        deviceScaleFactor: 1,
      });
      await context.addInitScript(() =>
        localStorage.setItem("jwtToken", "visual-fixture"),
      );
      if (!external)
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
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      for (const name of ["editor", "settings"]) {
        await page.goto(
          `http://127.0.0.1:5285/${name === "editor" ? "editor/article-1" : name}`,
          { waitUntil: "networkidle" },
        );
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.evaluate(() => {
          const rect = (s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              bottom: r.bottom,
            };
          };
          return {
            navbar: rect(".navbar"),
            brand: rect(".navbar-brand"),
            links: rect(".navbar-nav"),
            firstField: rect("form input"),
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.equal(geometry.overflow, false);
        assert.ok(
          geometry.brand.y < geometry.links.bottom &&
            geometry.brand.bottom > geometry.links.y,
          "brand and navigation must share a row",
        );
        if (name === "editor") {
          await expect(page.locator(".editor-page h1")).toHaveClass("sr-only");
          await expect(page.locator("#tag-input")).toHaveAccessibleDescription(
            "Press Enter to add a tag.",
          );
          await expect(page.locator("#tag-help")).toHaveClass("sr-only");
          await expect(page.getByRole("status")).toHaveClass("sr-only");
        }
        const screenshot = `${external ? "external" : "fallback"}-authenticated-${profile}-${name}.png`;
        await page.screenshot({ path: `${out}/${screenshot}`, fullPage: true });
        results.push({
          profile,
          page: name,
          externalResources: external,
          screenshot,
          ...geometry,
          errors: [...errors],
        });
      }
      // Navigation still focuses the accessible editor heading; Tab reaches its first input.
      await page
        .locator(".navbar")
        .getByRole("link", { name: "New Article" })
        .click();
      await expect(page.locator(".editor-page h1")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByPlaceholder("Article Title")).toBeFocused();
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  await writeFile(
    `${out}/detail-results.json`,
    JSON.stringify({ results }, null, 2),
  );
  console.log(
    "Passed profile focus/title, canonical tag placement/color/navigation, accessible editor content, and navbar overlap/overflow checks at both viewports.",
  );
} finally {
  await browser.close();
}
