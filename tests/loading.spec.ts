import { test, expect } from "./api-fixture";

for (const [size, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
})) {
  test(`${size} feed loading hides retained results and preserves failure/retry`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize(viewport);
    let release!: () => void;
    api.delays.set(
      "GET /articles",
      new Promise<void>((resolve) => (release = resolve)),
    );
    api.failures.set("GET /articles", 503);
    await page.goto("/");
    const loading = page.locator('.feed .article-preview[role="status"]');
    await expect(loading).toHaveText("Loading articles...");
    await expect(loading).toHaveCSS("padding-top", "24px");
    await expect(loading).toHaveCSS("padding-bottom", "24px");
    await expect(loading).toHaveCSS("border-top-width", "1px");
    release();
    await expect(page.getByRole("alert")).toContainText(
      "Fixture request failed",
    );
    api.delays.delete("GET /articles");
    api.failures.clear();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.locator(".preview-link:visible")).toHaveCount(20);
    const list = await page.locator(".feed-articles").elementHandle();
    const firstRow = await page
      .locator(".preview-link")
      .first()
      .elementHandle();

    api.delays.set(
      "GET /articles",
      new Promise<void>((resolve) => (release = resolve)),
    );
    api.failures.set("GET /articles", 503);
    await page.getByRole("link", { name: "2", exact: true }).click();
    await expect(loading).toBeVisible();
    await expect(page.locator(".feed-articles")).toBeHidden();
    await expect(page.locator(".feed-pages")).toBeHidden();
    await expect(page.locator(".preview-link:visible")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Article pages" }),
    ).toHaveCount(0);
    expect(await firstRow?.evaluate((el) => el.isConnected)).toBe(true);
    release();
    await expect(loading).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText(
      "Fixture request failed",
    );
    await expect(page.locator(".preview-link:visible")).toHaveCount(20);
    await expect(
      page.getByRole("navigation", { name: "Article pages" }),
    ).toBeVisible();
    expect(await firstRow?.evaluate((el) => el.isConnected)).toBe(true);

    api.failures.clear();
    api.delays.set(
      "GET /articles",
      new Promise<void>((resolve) => (release = resolve)),
    );
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(loading).toBeVisible();
    await expect(page.locator(".preview-link:visible")).toHaveCount(0);
    release();
    await expect(page.locator(".preview-link:visible")).toHaveCount(5);
    await expect(page.locator(".preview-link").first()).toContainText(
      "Article 21",
    );
    expect(await list?.evaluate((el) => el.isConnected)).toBe(true);
    expect(await firstRow?.evaluate((el) => el.isConnected)).toBe(false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    api.delays.set(
      "GET /articles",
      new Promise<void>((resolve) => (release = resolve)),
    );
    await page
      .locator(".sidebar")
      .getByRole("link", { name: "marionette", exact: true })
      .click();
    await expect(loading).toBeVisible();
    await page
      .locator(".navbar")
      .getByRole("link", { name: "Sign in", exact: true })
      .click();
    release();
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    expect(await list?.evaluate((el) => el.isConnected)).toBe(false);
    await expect(page.locator(".feed-articles")).toHaveCount(0);
  });
}
