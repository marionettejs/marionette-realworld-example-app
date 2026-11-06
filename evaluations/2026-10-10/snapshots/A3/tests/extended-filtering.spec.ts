import { test, expect } from "./api-fixture";

test("filters loaded articles by description using case-insensitive trimmed substring", async ({
  page,
  api,
}) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);

  const initialRequests = api.requests.length;
  const initialUrl = page.url();
  const filterInput = page.getByLabel("Filter loaded articles");

  // Description substring with surrounding whitespace and mixed case
  await filterInput.fill("  USEFUL INTRODUCTION 2  ");
  // Matches "A useful introduction 2" and "A useful introduction 20"
  await expect(page.locator(".preview-link:visible")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Article 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 20", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 1", exact: true }),
  ).toBeHidden();

  // No network requests triggered and no URL change
  expect(api.requests.length).toBe(initialRequests);
  expect(page.url()).toBe(initialUrl);

  // Clearing restores all articles
  await filterInput.fill("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
});

test("filters loaded articles by tag using case-insensitive trimmed substring", async ({
  page,
  api,
}) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);

  const initialRequests = api.requests.length;
  const initialUrl = page.url();
  const filterInput = page.getByLabel("Filter loaded articles");

  // Tag substring: "script" matches "javascript" on all odd-numbered articles (10 articles)
  await filterInput.fill("  SCRIPT  ");
  await expect(page.locator(".preview-link:visible")).toHaveCount(10);
  await expect(
    page.getByRole("link", { name: "Article 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 3", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 2", exact: true }),
  ).toBeHidden();

  // Tag substring: "test" matches "testing" on all even-numbered articles (10 articles)
  await filterInput.fill("TEST");
  await expect(page.locator(".preview-link:visible")).toHaveCount(10);
  await expect(
    page.getByRole("link", { name: "Article 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 4", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 1", exact: true }),
  ).toBeHidden();

  // No network requests triggered and no URL change
  expect(api.requests.length).toBe(initialRequests);
  expect(page.url()).toBe(initialUrl);

  // Clearing restores all articles
  await filterInput.fill("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
});
