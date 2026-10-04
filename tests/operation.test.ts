import { test } from "node:test";
import assert from "node:assert/strict";
import { Operation } from "../src/shared/operation.ts";
import { parseRoute } from "../src/app/routes.ts";
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
