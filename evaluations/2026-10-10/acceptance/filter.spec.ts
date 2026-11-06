// Operator-only acceptance. Never put this file in an active agent workspace.
import { test, expect } from "./api-fixture";

test("local filtering preserves rows, focus, domain data and network boundaries", async ({ page, api }) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);
  const rows = await page.locator(".preview-link").elementHandles();
  const filter = page.getByRole("textbox", { name: "Filter loaded articles", exact: true });
  const original = JSON.stringify(api.articles);
  const requests = api.requests.length;
  const url = page.url();
  await filter.fill("  aRTicle 19  ");
  await expect(page.locator(".preview-link:visible")).toHaveCount(1);
  await expect(page.locator(".preview-link:visible")).toContainText("Article 19");
  await expect(filter).toBeFocused();
  await filter.fill("no matching article");
  await expect(page.locator(".preview-link:visible")).toHaveCount(0);
  await expect(page.locator(".feed")).toContainText(/No .*?(articles|matches)/i);
  await filter.fill("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
  expect(await rows[0].evaluate(el => el === document.querySelector(".preview-link"))).toBe(true);
  expect(await rows[18].evaluate(el => el === document.querySelectorAll(".preview-link")[18])).toBe(true);
  expect(JSON.stringify(api.articles)).toBe(original);
  expect(api.requests.length).toBe(requests);
  expect(page.url()).toBe(url);
  await expect(page.getByRole("navigation", { name: "Article pages" })).toBeVisible();
});

test("filter survives refresh failure/retry and resets after navigation", async ({ page, api }) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);
  const filter = page.getByRole("textbox", { name: "Filter loaded articles", exact: true });
  await filter.fill("Article 2");
  await expect(page.locator(".preview-link:visible")).toHaveCount(2);
  const control = await filter.elementHandle();
  api.failures.set("GET /articles", 503);
  await page.getByRole("link", { name: "2", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture request failed");
  await expect(filter).toHaveValue("Article 2");
  await expect(page.locator(".preview-link:visible")).toHaveCount(2);
  api.failures.clear();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".preview-link:visible")).toHaveCount(5);
  await expect(filter).toHaveValue("Article 2");
  expect(await control?.evaluate(el => el.isConnected)).toBe(true);
  await page.locator(".navbar").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await page.locator(".navbar").getByRole("link", { name: "Home", exact: true }).click();
  await expect(filter).toHaveValue("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
});

test("profile feeds filter only their loaded rows", async ({ page }) => {
  await page.goto("/profile/writer");
  await expect(page.locator(".preview-link")).toHaveCount(20);
  await page.getByRole("textbox", { name: "Filter loaded articles", exact: true }).fill("Article 19");
  await expect(page.locator(".preview-link:visible")).toHaveCount(1);
});
