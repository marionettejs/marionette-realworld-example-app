import { test, expect, signIn } from "./api-fixture";

test("live reconciles input and textarea DOM resets with unchanged editor draft values", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "New Article" }).click();
  const title = page.getByPlaceholder("Article Title");
  const body = page.getByPlaceholder("Write your article (in markdown)");
  await title.fill("Retained draft");
  await page.getByPlaceholder("What's this article about?").fill("Description");
  await body.fill("Retained body");
  const titleNode = await title.elementHandle();
  const bodyNode = await body.elementHandle();
  const pending = Promise.withResolvers<void>();
  api.delays.set("POST /articles", pending.promise);
  api.failures.set("POST /articles", 503);
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(
    page.getByRole("button", { name: "Publish Article" }),
  ).toBeDisabled();
  // A native reset changes live properties without an input event or Model change.
  await page
    .locator(".editor-page form")
    .evaluate((form) => (form as HTMLFormElement).reset());
  await expect(title).toHaveValue("");
  await expect(body).toHaveValue("");
  pending.resolve();
  await expect(page.locator(".error-messages")).toContainText(
    "Fixture request failed",
  );
  await expect(title).toHaveValue("Retained draft");
  await expect(body).toHaveValue("Retained body");
  expect(await titleNode?.evaluate((el) => el.isConnected)).toBe(true);
  expect(await bodyNode?.evaluate((el) => el.isConnected)).toBe(true);
});

test("live reconciles the comment control without replacing its retained draft View", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.goto("/article/article-1");
  const body = page.getByPlaceholder("Write a comment...");
  await body.fill("Retained comment");
  const node = await body.elementHandle();
  const pending = Promise.withResolvers<void>();
  api.delays.set("POST /articles/article-1/comments", pending.promise);
  api.failures.set("POST /articles/article-1/comments", 503);
  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(
    page.getByRole("button", { name: "Post Comment" }),
  ).toBeDisabled();
  await page
    .locator("form.comment-form")
    .evaluate((form) => (form as HTMLFormElement).reset());
  await expect(body).toHaveValue("");
  pending.resolve();
  await expect(page.locator(".comments .error-messages")).toContainText(
    "Fixture request failed",
  );
  await expect(body).toHaveValue("Retained comment");
  expect(await node?.evaluate((el) => el.isConnected)).toBe(true);
});
