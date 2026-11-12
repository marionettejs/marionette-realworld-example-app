import { test, expect } from "./api-fixture";

test("router back and forward retain the document and home while restoring queries", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  const shell = await page.locator("header").elementHandle();
  const home = await page.locator(".home-page").elementHandle();
  await page.getByRole("link", { name: "2", exact: true }).click();
  await expect(page.locator(".article-preview")).toHaveCount(5);
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "testing", exact: true })
    .click();
  await expect(page.locator(".article-preview")).toHaveCount(12);
  await page.goBack();
  await expect(page.locator(".article-preview")).toHaveCount(5);
  await page.goForward();
  await expect(page).toHaveURL(/\/tag\/testing$/);
  await expect(page.locator(".article-preview")).toHaveCount(12);
  expect(await shell?.evaluate((el) => el.isConnected)).toBe(true);
  expect(await home?.evaluate((el) => el.isConnected)).toBe(true);
  await page.locator(".skip-link").focus();
  await page.locator(".skip-link").press("Enter");
  await expect(page).toHaveURL(/\/tag\/testing#main$/);
  await expect(page.locator("main")).toBeFocused();
  expect(await home?.evaluate((el) => el.isConnected)).toBe(true);
});

test("HTML property bindings retain field identity and focus through pending and error renders", async ({
  page,
  api,
}) => {
  await page.goto("/login");
  const email = page.getByPlaceholder("Email", { exact: true });
  const password = page.getByPlaceholder("Password", { exact: true });
  await email.fill("invalid@example.test");
  await password.fill("draft-password");
  const field = await password.elementHandle();
  const pending = Promise.withResolvers<void>();
  api.delays.set("POST /users/login", pending.promise);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await password.focus();
  await password.press("End");
  await password.pressSequentially("-newer");
  pending.resolve();
  await expect(page.locator(".error-messages")).toContainText("invalid");
  await expect(password).toHaveValue("draft-password-newer");
  await expect(password).toBeFocused();
  expect(await field?.evaluate((el) => el.isConnected)).toBe(true);
});
