import { test, expect, signIn } from "./api-fixture";

test("filter text control is present and labelled on home and profile feeds", async ({
  page,
}) => {
  await page.goto("/");
  const homeFilter = page.getByLabel("Filter loaded articles");
  await expect(homeFilter).toBeVisible();
  await expect(homeFilter).toHaveAttribute("type", "text");
  await expect(homeFilter).toHaveAttribute(
    "placeholder",
    "Filter loaded articles",
  );

  await page.goto("/profile/writer");
  const profileFilter = page.getByLabel("Filter loaded articles");
  await expect(profileFilter).toBeVisible();
  await expect(profileFilter).toHaveAttribute("type", "text");
});

test("filters loaded articles by case-insensitive substring and trimmed whitespace without network or URL changes", async ({
  page,
  api,
}) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);

  const initialRequests = api.requests.length;
  const initialUrl = page.url();
  const filterInput = page.getByLabel("Filter loaded articles");

  // Case-insensitive substring with surrounding whitespace
  await filterInput.fill("  ARTICLE 1  ");
  // "Article 1", "Article 10", ..., "Article 19" (11 articles)
  await expect(page.locator(".preview-link:visible")).toHaveCount(11);
  await expect(
    page.getByRole("link", { name: "Article 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 10", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Article 2", exact: true }),
  ).toBeHidden();

  // No network requests triggered
  expect(api.requests.length).toBe(initialRequests);
  // No URL change
  expect(page.url()).toBe(initialUrl);

  // Pagination totals remain unchanged
  await expect(
    page.getByRole("navigation", { name: "Article pages" }).getByRole("link"),
  ).toHaveCount(2);

  // Domain records intact
  const domainCount = await page.evaluate(() => {
    const app = window.__conduit_app__!;
    const feed = app.getChildApp("home")!.getChildApp("feed")! as import(
      "../src/features/feed/application"
    ).FeedApplication;
    return feed.articles.length;
  });
  expect(domainCount).toBe(20);

  // Substring match in middle of title
  await filterInput.fill("cle 2");
  // "Article 2", "Article 20" (2 articles)
  await expect(page.locator(".preview-link:visible")).toHaveCount(2);

  // Whitespace-only query restores every loaded row
  await filterInput.fill("   ");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);

  // Empty query restores every loaded row
  await filterInput.fill("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
});

test("shows clear empty presentation when nothing matches filter", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);

  const filterInput = page.getByLabel("Filter loaded articles");
  await filterInput.fill("nonexistent title match xyz");

  await expect(page.locator(".empty-feed-message")).toBeVisible();
  await expect(page.locator(".preview-link:visible")).toHaveCount(0);

  // Restores when query is cleared
  await filterInput.fill("");
  await expect(page.locator(".empty-feed-message")).toHaveCount(0);
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
});

test("preserves list and row DOM identities across hide/reveal, input focus, and favorite actions", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);

  const listHandle = await page.locator(".feed-articles").elementHandle();
  const row2Handle = await page
    .locator(".article-preview")
    .nth(1)
    .elementHandle();
  const filterInput = page.getByLabel("Filter loaded articles");

  // Focus input and type
  await filterInput.focus();
  await expect(filterInput).toBeFocused();
  await filterInput.pressSequentially("Article 1");
  await expect(filterInput).toBeFocused();

  // Row 2 is now hidden (detached)
  await expect(
    page.getByRole("link", { name: "Article 2", exact: true }),
  ).toHaveCount(0);

  // Clear query to reveal Row 2
  await filterInput.fill("");
  await expect(
    page.getByRole("link", { name: "Article 2", exact: true }),
  ).toBeVisible();

  // Check DOM identity of Row 2 is preserved
  const restoredRow2Handle = await page
    .locator(".article-preview")
    .nth(1)
    .elementHandle();
  const isSameRowNode = await page.evaluate(
    ([a, b]) => a === b,
    [row2Handle, restoredRow2Handle],
  );
  expect(isSameRowNode).toBe(true);

  // Check DOM identity of list is preserved
  const currentListHandle = await page
    .locator(".feed-articles")
    .elementHandle();
  const isSameListNode = await page.evaluate(
    ([a, b]) => a === b,
    [listHandle, currentListHandle],
  );
  expect(isSameListNode).toBe(true);

  // Favorite action while filtered retains row DOM identity
  await filterInput.fill("Article 1");
  const row1Handle = await page
    .locator(".article-preview")
    .first()
    .elementHandle();
  const favoriteButton = page
    .locator(".article-preview")
    .first()
    .getByRole("button", { name: /Favorite Article 1/ });
  await favoriteButton.click();
  await expect(
    page
      .locator(".article-preview")
      .first()
      .getByRole("button", { name: "Unfavorite Article 1" }),
  ).toBeVisible();

  const currentFavoriteRow = await page
    .locator(".article-preview")
    .first()
    .elementHandle();
  const isSameFavNode = await page.evaluate(
    ([a, b]) => a === b,
    [row1Handle, currentFavoriteRow],
  );
  expect(isSameFavNode).toBe(true);
  expect(await filterInput.inputValue()).toBe("Article 1");
});

test("filtering survives retained query refresh, applies to newly loaded rows, and resets on feed exit", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".preview-link")).toHaveCount(20);

  const filterInput = page.getByLabel("Filter loaded articles");
  // Filter for "Article 2" on page 1 (matches Article 2, Article 20)
  await filterInput.fill("Article 2");
  await expect(page.locator(".preview-link:visible")).toHaveCount(2);

  // Navigate to page 2 (retained route)
  await page.getByRole("link", { name: "2", exact: true }).click();
  // Page 2 has articles 21-25; all match "Article 2"
  await expect(page.locator(".preview-link:visible")).toHaveCount(5);
  // Filter input retains value
  await expect(filterInput).toHaveValue("Article 2");

  // Change filter on page 2 to "Article 25"
  await filterInput.fill("Article 25");
  await expect(page.locator(".preview-link:visible")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Article 25", exact: true }),
  ).toBeVisible();

  // Navigate back to page 1 via pagination (retained route)
  await page.getByRole("link", { name: "1", exact: true }).click();
  // On page 1, 0 articles match "Article 25" -> empty presentation
  await expect(page.locator(".empty-feed-message")).toBeVisible();
  await expect(page.locator(".preview-link:visible")).toHaveCount(0);
  await expect(filterInput).toHaveValue("Article 25");

  // Clearing restores all page 1 articles
  await filterInput.fill("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);

  // Set filter again before leaving feed
  await filterInput.fill("Article 1");
  await expect(page.locator(".preview-link:visible")).toHaveCount(11);

  // Leave the feed by navigating to /login
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();

  // Return to home feed: query must be reset
  await page.getByRole("link", { name: "conduit", exact: true }).click();
  const resetFilterInput = page.getByLabel("Filter loaded articles");
  await expect(resetFilterInput).toBeVisible();
  await expect(resetFilterInput).toHaveValue("");
  await expect(page.locator(".preview-link:visible")).toHaveCount(20);
});
