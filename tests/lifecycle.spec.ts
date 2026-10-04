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
      .getChildApp(
        "feed",
      )! as import("../src/features/feed/application").FeedApplication;
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
        .getChildApp(
          "feed",
        )! as import("../src/features/feed/application").FeedApplication;
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

test("same-user, unavailable, and superseded session refresh retain the editor draft", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.goto("/editor");
  await page.getByPlaceholder("Article Title").fill("Keep my draft");
  expect(
    await page.evaluate(async () => {
      const app = window.__conduit_app__!;
      const editor = app.getChildApp("editor")!;
      const view = editor.getView() as import("marionette").ViewInstance;
      await app.refreshSession();
      await app.routeTask;
      return editor.getView() === view && !view!.isDestroyed();
    }),
  ).toBe(true);
  api.failures.set("GET /user", 503);
  await page.evaluate(() => window.__conduit_app__!.refreshSession());
  await expect(page).toHaveURL("/editor");
  await expect(page.getByPlaceholder("Article Title")).toHaveValue(
    "Keep my draft",
  );
  await page.getByPlaceholder("What's this article about?").fill("Description");
  await page.getByPlaceholder("Write your article (in markdown)").fill("Body");
  await page.getByRole("button", { name: "Publish Article" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Verify your session" }),
  ).toBeVisible();
  expect(
    api.requests.filter((r) => r.method === "POST" && r.path === "/articles"),
  ).toHaveLength(0);
  api.failures.clear();
  await page.getByRole("button", { name: "Retry session" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__conduit_debug__.getAuthState()))
    .toBe("authenticated");
  expect(
    await page.evaluate(async () => {
      const app = window.__conduit_app__!;
      const view = app.getChildApp("editor")!.getView();
      const user = app.session.user()!;
      const original = app.session.api.current;
      const deferred: Array<(value: typeof user) => void> = [];
      app.session.api.current = () =>
        new Promise((resolve) => deferred.push(resolve));
      const first = app.refreshSession();
      await Promise.resolve();
      const second = app.refreshSession();
      await first;
      const retainedBeforeLatest =
        view === app.getChildApp("editor")!.getView();
      deferred.forEach((resolve) => resolve(user));
      await second;
      app.session.api.current = original;
      return (
        retainedBeforeLatest && view === app.getChildApp("editor")!.getView()
      );
    }),
  ).toBe(true);
  await expect(page.getByPlaceholder("Article Title")).toHaveValue(
    "Keep my draft",
  );
});

test("credential replacement rejects an old settings response before the new user resolves", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const putStarted = Promise.withResolvers<void>();
  const getStarted = Promise.withResolvers<void>();
  const put = Promise.withResolvers<void>();
  const get = Promise.withResolvers<void>();
  const oldUser = await page.evaluate(
    () => window.__conduit_debug__.getCurrentUser()!,
  );
  await page.route("**/api/user", async (route) => {
    if (route.request().method() === "PUT") {
      putStarted.resolve();
      await put.promise;
      await route.fulfill({
        json: { user: { ...oldUser, bio: "Old account save" } },
      });
    } else {
      getStarted.resolve();
      await get.promise;
      await route.fulfill({
        json: {
          user: {
            ...oldUser,
            username: "second-reader",
            token: "second-token",
          },
        },
      });
    }
  });
  await page.getByPlaceholder("Short bio about you").fill("Old account save");
  await page.getByRole("button", { name: "Update Settings" }).click();
  await putStarted.promise;
  await page.evaluate(() => {
    localStorage.setItem("jwtToken", "second-token");
    window.dispatchEvent(new StorageEvent("storage", { key: "jwtToken" }));
  });
  await getStarted.promise;
  put.resolve();
  await expect(
    page.getByRole("button", { name: "Update Settings" }),
  ).toBeEnabled();
  expect(await page.evaluate(() => window.__conduit_debug__.getToken())).toBe(
    "second-token",
  );
  await expect(page).toHaveURL("/settings");
  get.resolve();
  await expect(page.getByPlaceholder("Your Name")).toHaveValue("second-reader");
  expect(
    await page.evaluate(() => ({
      token: window.__conduit_debug__.getToken(),
      user: window.__conduit_debug__.getCurrentUser()?.username,
    })),
  ).toEqual({ token: "second-token", user: "second-reader" });
});

test("a settings completion that ignores cancellation cannot accept obsolete credentials", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  expect(
    await page.evaluate(async () => {
      const app = window.__conduit_app__!;
      const settings = app.getChildApp(
        "settings",
      ) as import("../src/features/settings/application").SettingsApplication;
      const oldUser = app.session.user()!;
      const pending = Promise.withResolvers<typeof oldUser>();
      app.session.api.updateUser = () => pending.promise;
      settings.submit();
      localStorage.setItem("jwtToken", "replacement");
      pending.resolve(oldUser);
      await Promise.resolve();
      await Promise.resolve();
      return {
        token: app.session.token(),
        route: location.pathname,
        pending: settings.getState().get("pending"),
      };
    }),
  ).toEqual({ token: "replacement", route: "/settings", pending: false });
});

test("a completed favorite supersedes a held feed snapshot", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.locator(".article-preview")).toHaveCount(20);
  expect(
    await page.evaluate(async () => {
      const app = window.__conduit_app__!;
      const feed = app
        .getChildApp("home")!
        .getChildApp(
          "feed",
        ) as import("../src/features/feed/application").FeedApplication;
      const row = feed.articles.at(0)!;
      const snapshot =
        row.toObject() as import("../src/shared/types").ArticleSummary;
      const pending = Promise.withResolvers<{
        articles: (typeof snapshot)[];
        articlesCount: number;
      }>();
      const original = app.session.api.articles.bind(app.session.api);
      let calls = 0;
      app.session.api.articles = (query, signal) =>
        ++calls === 1 ? pending.promise : original(query, signal);
      const staleRead = feed.load({ page: 1 });
      await Promise.resolve();
      await feed.favorite(row);
      pending.resolve({ articles: [snapshot], articlesCount: 1 });
      await staleRead;
      return calls;
    }),
  ).toBe(2);
  await expect(
    page.getByRole("button", { name: "Unfavorite Article 1", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".article-preview")).toHaveCount(20);
});

test("composite restart retains child Regions and comment drafts; stop/start reconstructs", async ({
  page,
}) => {
  await signIn(page);
  for (const [name, path] of [
    ["home", "/"],
    ["profile", "/profile/writer"],
    ["article", "/article/article-1"],
  ] as const) {
    await page.goto(path);
    await expect(
      page
        .locator(name === "article" ? ".comment-form" : ".preview-link")
        .first(),
    ).toBeVisible();
    if (name === "article")
      await page
        .getByPlaceholder("Write a comment...")
        .fill("Retained comment");
    expect(
      await page.evaluate(async (name) => {
        const feature = window.__conduit_app__!.getChildApp(name)!;
        const child = feature.getChildApp(
          name === "article" ? "comments" : "feed",
        )!;
        const root = feature.getView();
        const childView = child.getView() as import("marionette").ViewInstance;
        const region = child.getRegion();
        const options =
          name === "home"
            ? { query: { page: 1 } }
            : name === "profile"
              ? { username: "writer", query: { author: "writer", page: 1 } }
              : { slug: "article-1" };
        await feature.restart(options);
        return (
          root === feature.getView() &&
          childView === child.getView() &&
          region === child.getRegion() &&
          !childView!.isDestroyed()
        );
      }, name),
    ).toBe(true);
    if (name === "article")
      await expect(page.getByPlaceholder("Write a comment...")).toHaveValue(
        "Retained comment",
      );
  }
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.goto("/article/article-1");
  await expect(page.getByPlaceholder("Write a comment...")).toHaveValue("");
});

test("an obsolete activation failure cannot replace the newer destination", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".preview-link").first()).toBeVisible();
  await page.evaluate(async () => {
    const app = window.__conduit_app__!;
    const article = app.getChildApp(
      "article",
    ) as import("../src/features/article/application").ArticleApplication;
    article.onStart = () => {
      app.navigate("/login");
      throw new Error("Obsolete activation");
    };
    app.navigate("/article/article-1");
    await app.routeTask;
  });
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a write cannot use replaced credentials before the storage event is handled", async ({
  page,
  api,
}) => {
  await signIn(page);
  await page.goto("/settings");
  await page.evaluate(() => {
    localStorage.setItem("jwtToken", "unverified-token");
    const settings = window.__conduit_app__!.getChildApp(
      "settings",
    ) as import("../src/features/settings/application").SettingsApplication;
    settings.submit();
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Verify your session" }),
  ).toBeVisible();
  expect(
    api.requests.filter((r) => r.method === "PUT" && r.path === "/user"),
  ).toHaveLength(0);
  await expect(page.getByPlaceholder("Your Name")).toHaveValue("reader");
});

test("startup rechecks credentials changed before storage listeners are installed", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("jwtToken", "first-token"),
  );
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route("**/api/user", async (route) => {
    const first =
      route.request().headers().authorization === "Token first-token";
    if (first) {
      started.resolve();
      await release.promise;
    }
    await route.fulfill({
      json: {
        user: {
          username: first ? "first-user" : "second-user",
          email: "reader@example.test",
          image: null,
          bio: "",
          token: first ? "first-token" : "second-token",
        },
      },
    });
  });
  await page.goto("/settings");
  await started.promise;
  await page.evaluate(() => {
    localStorage.setItem("jwtToken", "second-token");
    window.dispatchEvent(new StorageEvent("storage", { key: "jwtToken" }));
  });
  release.resolve();
  await expect(page.getByPlaceholder("Your Name")).toHaveValue("second-user");
  expect(
    await page.evaluate(() => window.__conduit_debug__.getAuthState()),
  ).toBe("authenticated");
});
