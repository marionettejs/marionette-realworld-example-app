import { test, expect } from "./api-fixture";

test("extended filter matches description and tags without regressing title matching", async ({ page, api }) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);
  const filter = page.getByRole("textbox", { name: "Filter loaded articles", exact: true });
  const requests = api.requests.length;
  await filter.fill("  INTRODUCTION 19  ");
  await expect(page.locator(".preview-link:visible")).toHaveCount(1);
  await expect(page.locator(".preview-link:visible")).toContainText("Article 19");
  await filter.fill(" JaVaScRiPt ");
  await expect(page.locator(".preview-link:visible")).toHaveCount(10);
  await filter.fill("Article 20");
  await expect(page.locator(".preview-link:visible")).toHaveCount(1);
  await filter.fill("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
  expect(api.requests.length).toBe(requests);
});
