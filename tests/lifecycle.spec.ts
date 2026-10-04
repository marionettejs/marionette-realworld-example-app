import { test, expect, signIn } from "./api-fixture";

test("navigation cancels readiness and destroys the outgoing page and rows", async ({
  page,
  api,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  await page.evaluate(() => {
    const app = window.__conduit_app__!;
    const home = app.getChildApp("home")!;
    const feed = home.getChildApp("feed")!;
    const view = home.getView()!;
    const list = (
      feed.getView() as import("marionette").ViewInstance
    ).getChildView("articles")!;
    Object.assign(window, { previousHome: view, previousList: list });
  });
  const pending = Promise.withResolvers<void>();
  api.delays.set("GET /articles/article-1", pending.promise);
  await page.locator(".preview-link").first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Loading" }),
  ).toBeVisible();
  await page
    .locator(".navbar")
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  pending.resolve();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".article-page")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const old = window as unknown as {
        previousHome: import("marionette").ViewInstance;
        previousList: import("marionette").ViewInstance;
      };
      return [
        old.previousHome.isDestroyed(),
        old.previousList.isDestroyed(),
        window.__conduit_app__!.getChildApp("article")!.isRunning(),
      ];
    }),
  ).toEqual([true, true, false]);
});

test("rapid feed requests ignore obsolete data and preserve current query", async ({
  page,
  api,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  const pending = Promise.withResolvers<void>();
  api.delays.set("GET /articles", pending.promise);
  await page.getByRole("link", { name: "2", exact: true }).click();
  await expect
    .poll(() => api.requests.filter((r) => r.path === "/articles").length)
    .toBe(2);
  api.delays.delete("GET /articles");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "testing", exact: true })
    .click();
  await expect(page.locator(".article-preview")).toHaveCount(12);
  pending.resolve();
  await expect(page.locator(".feed-toggle .active")).toHaveText("# testing");
  await expect(page.locator(".article-preview").first()).toContainText(
    "Article 2",
  );
});

test("destroyed observable rows stop rendering when borrowed data changes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  const result = await page.evaluate(async () => {
    const app = window.__conduit_app__!;
    const feed = app
      .getChildApp("home")!
      .getChildApp("feed")! as import("../src/features/feed").FeedApplication;
    const list = (
      feed.getView() as import("marionette").ViewInstance
    ).getChildView("articles") as import("marionette").CollectionViewInstance;
    const row = list.children.toArray()[0] as import("marionette").ViewInstance;
    const model = feed.articles.at(0)!;
    let renders = 0;
    const original = row.render;
    row.render = function () {
      renders++;
      return original.call(this);
    };
    app.navigate("/login");
    await app.routeTask;
    model.set("title", "Changed after teardown");
    return {
      destroyed: row.isDestroyed(),
      renders,
      borrowedModelAlive: !model.isDestroyed(),
    };
  });
  expect(result).toEqual({
    destroyed: true,
    renders: 0,
    borrowedModelAlive: true,
  });
});

test("stop/start and restart keep one navigation subscription; destroy disposes descendants", async ({
  page,
  api,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  expect(
    await page.evaluate(async () => {
      const app = window.__conduit_app__!;
      const shell = app.getView() as import("marionette").ViewInstance;
      await app.restart();
      const retained = shell === app.getView();
      app.stop();
      const stopped = shell!.isDestroyed();
      await app.start();
      await app.routeTask;
      return { retained, stopped, replaced: shell !== app.getView() };
    }),
  ).toEqual({ retained: true, stopped: true, replaced: true });
  await expect(page.locator(".article-preview")).toHaveCount(20);
  const before = api.requests.filter((r) => r.path === "/articles").length;
  await page.evaluate(() => {
    history.pushState({}, "", "/?page=2");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.locator(".article-preview")).toHaveCount(5);
  expect(api.requests.filter((r) => r.path === "/articles").length).toBe(
    before + 1,
  );
  expect(
    await page.evaluate(() => {
      const app = window.__conduit_app__!;
      const children = Object.values(app.getChildApps());
      const state = app.session.getState();
      app.destroy();
      window.dispatchEvent(new PopStateEvent("popstate"));
      return {
        destroyed: children.every((child) => child.isDestroyed()),
        stateDestroyed: state.isDestroyed(),
        empty: document.querySelector("#app")?.childElementCount === 0,
      };
    }),
  ).toEqual({ destroyed: true, stateDestroyed: true, empty: true });
});

test("navigating away during save prevents late UI and session commits", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const pending = Promise.withResolvers<void>();
  api.delays.set("PUT /user", pending.promise);
  await page.getByPlaceholder("Your Name").fill("new-reader");
  await page.getByRole("button", { name: "Update Settings" }).click();
  await expect
    .poll(() =>
      api.requests.some((r) => r.method === "PUT" && r.path === "/user"),
    )
    .toBe(true);
  await page
    .locator(".navbar")
    .getByRole("link", { name: "Home", exact: true })
    .click();
  pending.resolve();
  await expect(page.locator(".article-preview")).toHaveCount(20);
  expect(
    await page.evaluate(
      () => window.__conduit_debug__.getCurrentUser()?.username,
    ),
  ).toBe("reader");
  await expect(page).toHaveURL("/");
});

test("Marionette preparation rejects stale completion even when API ignores its abort signal", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".article-preview")).toHaveCount(20);
  expect(
    await page.evaluate(async () => {
      const app = window.__conduit_app__!;
      const feed = app
        .getChildApp("home")!
        .getChildApp("feed")! as import("../src/features/feed").FeedApplication;
      const original = app.session.api.articles.bind(app.session.api);
      const sample = feed.articles
        .at(0)!
        .toObject() as import("../src/shared/types").ArticleSummary;
      const pending = Promise.withResolvers<{
        articles: import("../src/shared/types").ArticleSummary[];
        articlesCount: number;
      }>();
      let firstSignal: AbortSignal | undefined;
      app.session.api.articles = async (query, signal) => {
        if (query.page === 2) {
          firstSignal = signal;
          return pending.promise;
        }
        return {
          articles: [{ ...sample, title: "Current result" }],
          articlesCount: 1,
        };
      };
      const first = feed.load({ page: 2 });
      await feed.load({ page: 3 });
      pending.resolve({
        articles: [{ ...sample, title: "Obsolete result" }],
        articlesCount: 1,
      });
      await first;
      app.session.api.articles = original;
      return {
        aborted: firstSignal?.aborted,
        title: feed.articles.at(0)?.get("title"),
      };
    }),
  ).toEqual({ aborted: true, title: "Current result" });
});
