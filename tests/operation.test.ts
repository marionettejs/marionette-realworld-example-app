import { test } from "node:test";
import assert from "node:assert/strict";
import { Operation } from "../src/shared/operation.ts";
import {
  Router,
  RouteApplication,
  memoryDriver,
  type ActiveMatch,
} from "@mnjs/router";
import { pageRoutes } from "../src/app/routes.ts";
import { homeRoutes, homeQuery } from "../src/features/home/routes.ts";
import { profileRoutes, profileQuery } from "../src/features/profile/routes.ts";
import { articleRoutes } from "../src/features/article/routes.ts";
import { editorRoutes } from "../src/features/editor/routes.ts";
import { authRoutes } from "../src/features/auth/routes.ts";
import { settingsRoutes } from "../src/features/settings/routes.ts";
const Owner = RouteApplication.extend({
  routes: pageRoutes,
  childApps: {
    home: RouteApplication.extend({ routes: homeRoutes }),
    profile: RouteApplication.extend({ routes: profileRoutes }),
    article: RouteApplication.extend({ routes: articleRoutes }),
    editor: RouteApplication.extend({ routes: editorRoutes }),
    auth: RouteApplication.extend({ routes: authRoutes }),
    settings: RouteApplication.extend({ routes: settingsRoutes }),
  },
});
const owner = new Owner();
const router = new Router({
  driver: memoryDriver({ url: "https://example.test/" }),
});
owner.mountRoutes(router);
test("cancelled operations cannot commit even when transport ignores abort", async () => {
  const op = new Operation();
  const response = Promise.withResolvers<number>();
  let signal: AbortSignal | undefined;
  const commits: number[] = [];
  const first = op.run(
    (value) => {
      signal = value;
      return response.promise;
    },
    (value) => commits.push(value),
    () => assert.fail("cancelled error delivered"),
  );
  op.cancel();
  assert.equal(signal?.aborted, true);
  await op.run(
    async () => 2,
    (value) => commits.push(value),
    () => assert.fail(),
  );
  response.resolve(1);
  await first;
  assert.deepEqual(commits, [2]);
});
test("duplicate writes are ignored and failure permits an explicit retry", async () => {
  const op = new Operation();
  const response = Promise.withResolvers<number>();
  let calls = 0;
  let errors = 0;
  const first = op.run(
    () => {
      calls++;
      return response.promise;
    },
    () => assert.fail(),
    () => {
      errors++;
    },
  );
  await op.run(
    async () => {
      calls++;
      return 2;
    },
    () => assert.fail(),
    () => assert.fail(),
  );
  response.reject(new Error("offline"));
  await first;
  await op.run(
    async () => {
      calls++;
      return 3;
    },
    (value) => assert.equal(value, 3),
    () => assert.fail(),
  );
  assert.equal(calls, 2);
  assert.equal(errors, 1);
});
test("feature routes decode filters and preserve invalid-page and unknown-route behavior", () => {
  const tag = router.match("https://example.test/tag/c%2B%2B?page=2")!;
  assert.equal(tag.name, "tag");
  assert.deepEqual(homeQuery(tag), { tag: "c++", page: 2 });
  const favorites = router.match(
    "https://example.test/profile/reader/favorites?page=-1",
  )!;
  assert.equal(favorites.name, "favorites");
  assert.deepEqual(profileQuery(favorites), { favorited: "reader", page: 1 });
  for (const [pathname, name] of [
    ["/", "home"],
    ["/login", "login"],
    ["/register", "register"],
    ["/editor", "editor"],
    ["/editor/saved", "edit"],
    ["/settings", "settings"],
  ]) {
    assert.equal(router.match(`https://example.test${pathname}`)?.name, name);
  }
  assert.equal(
    router.match("https://example.test/settings")?.meta.requiresUser,
    true,
  );
  assert.equal(router.match("https://example.test/%ZZ"), null);
  assert.equal(router.match("https://example.test/editor/extra/path"), null);
});

test("feature-owned named routes round-trip encoded resources through the official matcher", () => {
  const slug = "article/with spaces + symbols";
  const href = router.url("article", { slug });
  const match = router.match(new URL(href, "https://example.test"))!;
  assert.equal(match.name, "article");
  assert.equal(match.params.slug, slug);
  assert.equal(
    router.url("favorites", { username: "reader" }, { query: { page: 2 } }),
    "/profile/reader/favorites?page=2",
  );
  assert.equal(router.match("https://example.test/tag/%ZZ"), null);
});

test("router navigation cancels obsolete readiness and stops its owned driver", async () => {
  const driver = memoryDriver({ url: "https://example.test/" });
  const slow = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  let obsolete: AbortSignal | undefined;
  const routed = new Router({
    driver,
    routes: {
      "/": { name: "home" },
      "/article/:slug": { name: "article" },
      "/login": { name: "login" },
      "/register": { name: "register" },
    },
    handler: async (match) => {
      if (match.name === "article") {
        obsolete = match.signal;
        entered.resolve();
        await slow.promise;
      }
    },
  });
  const ready: string[] = [];
  routed.on("route:ready", (match: ActiveMatch) => ready.push(match.name));
  try {
    await routed.start();
    assert.equal((await routed.getInitialDispatch())?.status, "matched");
    const first = routed.navigate("article", { slug: "slow" });
    await entered.promise;
    assert.equal(await routed.navigate("login").finished, true);
    assert.equal(await first.finished, false);
    assert.equal(obsolete?.aborted, true);
    slow.resolve();
    await Promise.resolve();
    assert.deepEqual(ready, ["home", "login"]);
    routed.stop();
    assert.equal(await routed.navigate("register").finished, false);
    assert.equal(new URL(driver.currentEntry.url).pathname, "/login");
    await routed.start();
    assert.equal((await routed.getInitialDispatch())?.status, "matched");
    assert.equal(await routed.navigate("register").finished, true);
  } finally {
    slow.resolve();
    routed.destroy();
  }
});
