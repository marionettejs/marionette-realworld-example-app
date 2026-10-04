/* global process, Buffer, URL, setTimeout, console */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const base = process.env.BENCH_ROOT || "/tmp/realworld-reference-benchmarks";
const counts = {};
const author = {
  username: "writer",
  bio: "Benchmark author",
  image: "http://127.0.0.1:5280/avatar.svg",
  following: false,
};
const article = (n) => ({
  slug: `article-${n}`,
  title: `Article ${n}`,
  description: "A common benchmark article description.",
  tagList: ["javascript", "testing"],
  createdAt: "2026-10-04T01:00:00Z",
  updatedAt: "2026-10-04T01:00:00Z",
  favorited: false,
  favoritesCount: 3,
  author,
  body: "A paragraph about predictable application ownership.\n\n".repeat(20),
});
const comments = Array.from({ length: 10 }, (_, n) => ({
  id: n + 1,
  body: `Benchmark comment ${n + 1}`,
  createdAt: "2026-10-04T01:00:00Z",
  updatedAt: "2026-10-04T01:00:00Z",
  author,
}));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
function send(req, res, body, type, status = 200) {
  const raw = Buffer.from(body);
  const gzip =
    /gzip/.test(req.headers["accept-encoding"] || "") &&
    /text|json|javascript|svg/.test(type);
  const bytes = gzip ? gzipSync(raw, { level: 9 }) : raw;
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": bytes.length,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Cache-Control": "no-store",
    ...(gzip ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : {}),
  });
  res.end(bytes);
}
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "OPTIONS") return send(req, res, "", "text/plain", 204);
    if (url.pathname === "/__stats")
      return send(req, res, JSON.stringify(counts), "application/json");
    if (url.pathname === "/avatar.svg")
      return send(
        req,
        res,
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#5cb85c"/></svg>',
        "image/svg+xml",
      );
    if (req.method !== "GET")
      return send(
        req,
        res,
        '{"errors":{"body":["Benchmark is read-only"]}}',
        "application/json",
        405,
      );
    counts[url.pathname] = (counts[url.pathname] || 0) + 1;
    await new Promise((resolve) => setTimeout(resolve, 40));
    let value;
    if (url.pathname === "/api/tags")
      value = { tags: ["javascript", "testing"] };
    else if (
      url.pathname === "/api/articles" ||
      url.pathname === "/api/articles/feed"
    ) {
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Math.min(Number(url.searchParams.get("limit") || 20), 1000);
      value = {
        articles: Array.from({ length: limit }, (_, n) => {
          const summary = article(n + offset + 1);
          delete summary.body;
          return summary;
        }),
        articlesCount: 200,
      };
    } else if (/^\/api\/articles\/[^/]+\/comments$/.test(url.pathname))
      value = { comments };
    else if (/^\/api\/articles\/[^/]+$/.test(url.pathname))
      value = { article: article(Number(url.pathname.split("-").at(-1)) || 1) };
    else if (url.pathname.startsWith("/api/profiles/"))
      value = { profile: author };
    else
      return send(
        req,
        res,
        '{"errors":{"body":["Unknown or unauthenticated endpoint"]}}',
        "application/json",
        url.pathname === "/api/user" ? 401 : 404,
      );
    send(req, res, JSON.stringify(value), "application/json");
  })
  .listen(5280, "127.0.0.1");

for (const [name, port, folder] of [
  ["vue", 5281, "dist"],
  ["react", 5282, "build"],
  ["angular", 5283, "dist/angular-conduit/browser"],
  ["marionette", 5285, "dist"],
]) {
  const root =
    name === "marionette" && process.env.MARIONETTE_DIST
      ? path.resolve(process.env.MARIONETTE_DIST)
      : path.resolve(base, name, folder);
  http
    .createServer(async (req, res) => {
      try {
        let file = path.resolve(
          root,
          "." +
            decodeURIComponent(new URL(req.url, "http://localhost").pathname),
        );
        if (!file.startsWith(root + path.sep) && file !== root)
          return send(req, res, "Forbidden", "text/plain", 403);
        try {
          if (!(await stat(file)).isFile())
            file = path.join(root, "index.html");
        } catch {
          file = path.join(root, "index.html");
        }
        send(
          req,
          res,
          await readFile(file),
          types[path.extname(file)] || "application/octet-stream",
        );
      } catch (error) {
        send(req, res, String(error), "text/plain", 500);
      }
    })
    .listen(port, "127.0.0.1");
}
console.log(
  "Fixture :5280; Vue :5281; React :5282; Angular :5283. API writes rejected.",
);
