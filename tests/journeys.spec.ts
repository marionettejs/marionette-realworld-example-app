import { test, expect, signIn, testUser, makeArticle } from "./api-fixture";

test("global feed, tag filtering, pagination and browser history retain shell and home", async ({
  page,
  api,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  const shell = await page.locator("header").elementHandle();
  const home = await page.locator(".home-page").elementHandle();
  await page.getByRole("link", { name: "2", exact: true }).click();
  await expect(page.locator(".article-preview")).toHaveCount(5);
  await expect(page.locator(".article-preview").first()).toContainText(
    "Article 21",
  );
  expect(await home?.evaluate((el) => el.isConnected)).toBe(true);
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "marionette", exact: true })
    .click();
  await expect(page.locator(".article-preview")).toHaveCount(13);
  await expect(page).toHaveURL(/\/tag\/marionette$/);
  expect(api.requests.at(-1)?.query).toContain("tag=marionette");
  await page.goBack();
  await expect(page.locator(".article-preview")).toHaveCount(5);
  expect(await shell?.evaluate((el) => el.isConnected)).toBe(true);
});

test("registration, reload session, settings update, empty password omission and logout", async ({
  page,
  api,
}) => {
  await page.goto("/register");
  await page.getByPlaceholder("Username").fill("reader");
  await page.getByPlaceholder("Email", { exact: true }).fill(testUser.email);
  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("fixture-password");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.locator(".navbar")).toContainText("reader");
  expect(await page.evaluate(() => localStorage.getItem("jwtToken"))).toBe(
    "fixture-token",
  );
  await page.reload();
  await expect(page.locator(".navbar")).toContainText("reader");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByPlaceholder("Short bio about you").fill("Updated bio");
  await page.getByRole("button", { name: "Update Settings" }).click();
  await expect(page.locator(".user-info")).toContainText("Updated bio");
  const update = api.requests.find(
    (r) => r.method === "PUT" && r.path === "/user",
  )!;
  expect(update.body.user).not.toHaveProperty("password");
  expect(update.authorization).toBe("Token fixture-token");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /Or click here/ }).click();
  await expect(page.locator(".navbar")).toContainText("Sign in");
  expect(
    await page.evaluate(() => localStorage.getItem("jwtToken")),
  ).toBeNull();
});

test("failed sign in retains fields and permits correction; protected direct routes redirect", async ({
  page,
}) => {
  await page.goto("/editor");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByPlaceholder("Email", { exact: true })
    .fill("invalid@example.test");
  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error-messages")).toContainText(
    "email or password is invalid",
  );
  await expect(page.getByPlaceholder("Email", { exact: true })).toHaveValue(
    "invalid@example.test",
  );
  await page.getByPlaceholder("Email", { exact: true }).fill(testUser.email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".navbar")).toContainText("reader");
});

test("create, read markdown, edit slug, profile author list and delete article", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "New Article" }).click();
  await page.getByPlaceholder("Article Title").fill("My guide");
  await page
    .getByPlaceholder("What's this article about?")
    .fill("A description");
  await page
    .getByPlaceholder("Write your article (in markdown)")
    .fill("# Safe heading\n\n**Bold text**");
  await page.getByPlaceholder("Enter tags").fill("marionette");
  await page.getByPlaceholder("Enter tags").press("Enter");
  await page.getByPlaceholder("Enter tags").fill("remove-me");
  await page.getByPlaceholder("Enter tags").press("Enter");
  await page.getByRole("button", { name: "Remove tag remove-me" }).click();
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(page.locator(".article-content strong")).toHaveText("Bold text");
  await expect(page.locator(".article-page .banner h1")).toHaveText("My guide");
  await page
    .getByRole("link", { name: "Edit Article", exact: true })
    .first()
    .click();
  await expect(page.getByPlaceholder("Article Title")).toHaveValue("My guide");
  await page.getByRole("button", { name: "Remove tag marionette" }).click();
  await page.getByPlaceholder("Enter tags").fill("revised");
  await page.getByPlaceholder("Enter tags").press("Enter");
  await page.getByPlaceholder("Article Title").fill("My revised guide");
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(page).toHaveURL(/-edited$/);
  expect(
    api.requests.find(
      (r) => r.method === "PUT" && r.path.startsWith("/articles"),
    )?.body.article,
  ).toHaveProperty("tagList", ["revised"]);
  await page.locator(".navbar").getByRole("link", { name: "reader" }).click();
  await expect(page.locator(".article-preview")).toContainText(
    "My revised guide",
  );
  await page.locator(".preview-link").click();
  await page.getByRole("button", { name: "Delete Article" }).first().click();
  await expect(page).toHaveURL("/");
  expect(api.articles.some((a) => a.title === "My revised guide")).toBe(false);
});

test("favorites, followed feed, profile tabs and synchronized article metadata", async ({
  page,
}) => {
  await signIn(page);
  await page.locator(".article-preview").first().getByRole("button").click();
  await expect(
    page.locator(".article-preview").first().getByRole("button"),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .locator(".article-preview")
    .first()
    .locator(".preview-link")
    .click();
  await page
    .getByRole("button", { name: "Follow writer", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Unfollow writer", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: /Unfavorite Article/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Favorite Article (0)", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Favorite Article (0)", exact: true })
    .first()
    .click();
  await page.locator(".navbar").getByRole("link", { name: "reader" }).click();
  await page.getByRole("link", { name: "Favorited Articles" }).click();
  await expect(page.locator(".article-preview")).toHaveCount(1);
  await page
    .locator(".navbar")
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await page.getByRole("link", { name: "Your Feed", exact: true }).click();
  await expect(page.locator(".article-preview")).toHaveCount(20);
  await page
    .locator(".article-preview")
    .first()
    .getByRole("link", { name: "writer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Unfollow writer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Follow writer", exact: true }),
  ).toBeVisible();
});

test("comments retain newer typing during pending post, then delete only owned comment", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.goto("/article/article-1");
  await expect(page.locator(".card:not(.comment-form)")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Delete comment" }),
  ).toHaveCount(0);
  const pending = Promise.withResolvers<void>();
  api.delays.set("POST /articles/article-1/comments", pending.promise);
  const input = page.getByPlaceholder("Write a comment...");
  await input.fill("Submitted comment");
  const node = await input.elementHandle();
  await page.getByRole("button", { name: "Post Comment" }).click();
  await input.fill("Newer draft");
  pending.resolve();
  await expect(page.locator(".card:not(.comment-form)")).toHaveCount(2);
  await expect(input).toHaveValue("Newer draft");
  expect(
    await node?.evaluate((el) => el === document.querySelector("textarea")),
  ).toBe(true);
  await page.getByRole("button", { name: "Delete comment" }).click();
  await expect(page.locator(".card:not(.comment-form)")).toHaveCount(1);
});

test("feed errors are explicit, retryable and retain layout during failed refresh", async ({
  page,
  api,
}) => {
  api.failures.set("GET /articles", 503);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Fixture request failed");
  expect(api.requests.filter((r) => r.path === "/articles")).toHaveLength(1);
  api.failures.delete("GET /articles");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".article-preview")).toHaveCount(20);
  const home = await page.locator(".home-page").elementHandle();
  api.failures.set("GET /articles", 503);
  await page.getByRole("link", { name: "2", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture request failed");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  expect(await home?.evaluate((el) => el.isConnected)).toBe(true);
  api.failures.delete("GET /articles");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".article-preview")).toHaveCount(5);
});

test("session outage preserves token, explicit retry restores and expired token clears", async ({
  page,
  api,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("jwtToken", "fixture-token"),
  );
  api.failures.set("GET /user", 503);
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Retry session" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__conduit_debug__.getAuthState()),
  ).toBe("unavailable");
  api.failures.delete("GET /user");
  await page.getByRole("button", { name: "Retry session" }).click();
  await expect(page.getByPlaceholder("Your Name")).toHaveValue("reader");
  api.failures.set("PUT /user", 401);
  await page.getByRole("button", { name: "Update Settings" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem("jwtToken")),
  ).toBeNull();
});

test("Markdown and text escape XSS, unknown routes and guest actions", async ({
  page,
  api,
}) => {
  api.articles[0] = {
    ...makeArticle(),
    title: "<img src=x onerror=alert(1)>",
    body: '<script>window.pwned=true</script>\n<img src=x onerror="window.pwned=true">\n[bad](javascript:alert(1))\n\n**Safe**',
  };
  await page.goto("/article/article-1");
  await expect(page.locator(".article-content strong")).toHaveText("Safe");
  await expect(page.locator(".article-page .banner h1")).toHaveText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(
    page.locator(
      '.article-content script, .article-content [onerror], .article-content a[href^="javascript:"]',
    ),
  ).toHaveCount(0);
  await expect(page.getByPlaceholder("Write a comment...")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Favorite Article (0)", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/missing");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("editor keeps newer text after save and updates the returned slug on next save", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "New Article" }).click();
  await page.getByPlaceholder("Article Title").fill("Pending draft");
  await page.getByPlaceholder("What's this article about?").fill("Description");
  await page
    .getByPlaceholder("Write your article (in markdown)")
    .fill("Submitted body");
  const pending = Promise.withResolvers<void>();
  api.delays.set("POST /articles", pending.promise);
  await page.getByRole("button", { name: "Publish Article" }).click();
  await page
    .getByPlaceholder("Write your article (in markdown)")
    .fill("Newer body");
  pending.resolve();
  await expect(page.getByRole("status")).toContainText(
    "Your newer changes remain",
  );
  await expect(
    page.getByPlaceholder("Write your article (in markdown)"),
  ).toHaveValue("Newer body");
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(page.locator(".article-content")).toContainText("Newer body");
  expect(
    api.requests.filter((r) => r.method === "POST" && r.path === "/articles"),
  ).toHaveLength(1);
});

test("comment deletion cannot invoke article deletion; editor denies nonauthor", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.goto("/article/article-1");
  await page.getByPlaceholder("Write a comment...").fill("Owned comment");
  await page.getByRole("button", { name: "Post Comment" }).click();
  await page.getByRole("button", { name: "Delete comment" }).click();
  await expect(page.locator(".card:not(.comment-form)")).toHaveCount(1);
  await expect(page).toHaveURL("/article/article-1");
  expect(
    api.requests.filter(
      (r) => r.method === "DELETE" && r.path === "/articles/article-1",
    ),
  ).toHaveLength(0);
  await page.goto("/editor/article-1");
  await expect(page.getByRole("alert")).toContainText("Only the author");
  await expect(
    page.getByRole("button", { name: "Publish Article" }),
  ).toHaveCount(0);
});

test("failed article and comment writes preserve drafts and allow explicit resubmission", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "New Article" }).click();
  await page.getByPlaceholder("Article Title").fill("Retry draft");
  await page.getByPlaceholder("What's this article about?").fill("Description");
  await page
    .getByPlaceholder("Write your article (in markdown)")
    .fill("Keep this body");
  api.failures.set("POST /articles", 422);
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(page.locator(".error-messages")).toContainText(
    "Fixture request failed",
  );
  await expect(
    page.getByPlaceholder("Write your article (in markdown)"),
  ).toHaveValue("Keep this body");
  api.failures.delete("POST /articles");
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(page.locator(".article-content")).toContainText(
    "Keep this body",
  );
  const slug = api.articles[0].slug;
  api.failures.set(`POST /articles/${slug}/comments`, 503);
  await page.getByPlaceholder("Write a comment...").fill("Keep my comment");
  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(page.getByPlaceholder("Write a comment...")).toHaveValue(
    "Keep my comment",
  );
  await expect(page.locator(".comments .error-messages")).toContainText(
    "Fixture request failed",
  );
  api.failures.delete(`POST /articles/${slug}/comments`);
  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(page.locator(".card:not(.comment-form)").first()).toContainText(
    "Keep my comment",
  );
});

test("desktop and mobile Conduit layout, keyboard focus and empty feed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".navbar")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (await page.locator(".article-preview").first().boundingBox())!.width,
  ).toBeGreaterThan(330);
  await page
    .locator(".navbar")
    .getByRole("link", { name: "Sign in", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeFocused();
  await page.goto("/tag/absent");
  await expect(page.locator(".empty-feed-message")).toContainText(
    "No articles here",
  );
});
