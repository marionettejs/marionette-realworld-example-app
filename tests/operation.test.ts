import { test } from "node:test";
import assert from "node:assert/strict";
import { Operation } from "../src/shared/operation.ts";
import { Router, memoryDriver, type ActiveMatch } from "@mnjs/router";
import { routeFor, routes } from "../src/app/routes.ts";
const router = new Router({
  driver: memoryDriver({ url: "https://example.test/" }),
  routes,
});
const parseRoute = (url: URL) => routeFor(router.match(url), url);
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
test("route decoding, filters, invalid pages and unknown routes", () => {
  assert.deepEqual(
    parseRoute(new URL("https://example.test/tag/c%2B%2B?page=2")),
    { kind: "home", key: "home", feed: { tag: "c++", page: 2 } },
  );
  assert.deepEqual(
    parseRoute(
      new URL("https://example.test/profile/reader/favorites?page=-1"),
    ),
    {
      kind: "profile",
      key: "profile:reader",
      username: "reader",
      feed: { favorited: "reader", page: 1 },
    },
  );
  assert.equal(parseRoute(new URL("https://example.test/%ZZ")).kind, "missing");
  assert.equal(
    parseRoute(new URL("https://example.test/editor/extra/path")).kind,
    "missing",
  );
});

test("named routes round-trip encoded resources through the official matcher", () => {
  const slug = "article/with spaces + symbols";
  const href = router.url("article", { slug });
  const url = new URL(href, "https://example.test");
  assert.deepEqual(routeFor(router.match(url), url), {
    kind: "article",
    key: url.pathname,
    slug,
  });
  assert.equal(
    router.url("favorites", { username: "reader" }, { query: { page: 2 } }),
    "/profile/reader/favorites?page=2",
  );
  assert.equal(
    parseRoute(new URL("https://example.test/tag/%ZZ")).kind,
    "missing",
  );
});

test("router navigation cancels obsolete readiness and stops its owned driver", async () => {
  const driver = memoryDriver({ url: "https://example.test/" });
  const slow = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  let obsolete: AbortSignal | undefined;
  const routed = new Router({
    driver,
    routes,
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
