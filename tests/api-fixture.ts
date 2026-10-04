import { test as base, expect, type Page } from "@playwright/test";
import type { Article, Comment, Profile, User } from "../src/shared/types";
export const testUser: User = {
  username: "reader",
  email: "reader@example.test",
  bio: "A curious reader.",
  image: null,
  token: "fixture-token",
};
export const author: Profile = {
  username: "writer",
  bio: "Writes about small software.",
  image: null,
  following: false,
};
export function makeArticle(index = 1, owner = author): Article {
  return {
    slug: `article-${index}`,
    title: `Article ${index}`,
    description: `A useful introduction ${index}`,
    body: "# A thoughtful article\n\nRead **carefully**.",
    tagList: index % 2 ? ["marionette", "javascript"] : ["testing"],
    createdAt: "2026-10-04T01:00:00Z",
    updatedAt: "2026-10-04T01:00:00Z",
    favorited: false,
    favoritesCount: 0,
    author: { ...owner },
  };
}
export type RequestLog = {
  method: string;
  path: string;
  query: string;
  body: Record<string, unknown>;
  authorization?: string;
};
export async function mockApi(page: Page) {
  const state = {
    user: { ...testUser },
    articles: Array.from({ length: 25 }, (_, i) => makeArticle(i + 1)),
    comments: [
      {
        id: 1,
        body: "First comment",
        createdAt: "2026-10-04T01:00:00Z",
        updatedAt: "2026-10-04T01:00:00Z",
        author: { ...author },
      },
    ] as Comment[],
    following: false,
    requests: [] as RequestLog[],
    failures: new Map<string, number>(),
    delays: new Map<string, Promise<void>>(),
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname.slice(4));
    const method = request.method();
    const body = request.postDataJSON() || {};
    const authorization = request.headers().authorization;
    state.requests.push({
      method,
      path,
      query: url.search,
      body,
      authorization,
    });
    const key = `${method} ${path}`;
    if (state.delays.has(key)) await state.delays.get(key);
    const status = state.failures.get(key);
    const send = (json: unknown, status = 200) =>
      route.fulfill({ status, json });
    if (status)
      return send({ errors: { body: ["Fixture request failed"] } }, status);
    if (path === "/users/login" || path === "/users") {
      const fields = body.user;
      if (fields.email === "invalid@example.test")
        return send({ errors: { "email or password": ["is invalid"] } }, 422);
      state.user = { ...state.user, ...fields };
      delete (state.user as Partial<{ password: string }>).password;
      return send({ user: state.user });
    }
    if (path === "/user") {
      if (!authorization)
        return send({ errors: { session: ["expired"] } }, 401);
      if (method === "PUT") {
        state.user = { ...state.user, ...body.user };
        delete (state.user as Partial<{ password: string }>).password;
      }
      return send({ user: state.user });
    }
    if (path === "/tags")
      return send({ tags: ["marionette", "javascript", "testing"] });
    if (path.startsWith("/profiles/")) {
      const username = path.split("/")[2];
      if (path.endsWith("/follow")) state.following = method === "POST";
      return send({
        profile:
          username === state.user.username
            ? { ...state.user, following: false }
            : { ...author, username, following: state.following },
      });
    }
    if (path === "/articles" && method === "POST") {
      const article = {
        ...makeArticle(100, { ...state.user, following: false }),
        ...body.article,
        slug: `new-${state.articles.length}`,
      };
      state.articles.unshift(article);
      return send({ article }, 201);
    }
    if (path === "/articles" || path === "/articles/feed") {
      let articles = state.articles;
      if (url.searchParams.has("tag"))
        articles = articles.filter((a) =>
          a.tagList.includes(url.searchParams.get("tag")!),
        );
      if (url.searchParams.has("author"))
        articles = articles.filter(
          (a) => a.author.username === url.searchParams.get("author"),
        );
      if (url.searchParams.has("favorited"))
        articles = articles.filter((a) => a.favorited);
      if (path === "/articles/feed" && !state.following) articles = [];
      const offset = Number(url.searchParams.get("offset"));
      const limit = Number(url.searchParams.get("limit"));
      return send({
        articles: articles
          .slice(offset, offset + limit)
          .map(({ body: _body, ...summary }) => summary),
        articlesCount: articles.length,
      });
    }
    const slug = path.split("/")[2];
    const article = state.articles.find((a) => a.slug === slug);
    if (!article) return send({ errors: { article: ["not found"] } }, 404);
    if (path.endsWith("/favorite")) {
      article.favorited = method === "POST";
      article.favoritesCount = article.favorited ? 1 : 0;
      return send({ article });
    }
    if (path.includes("/comments")) {
      if (method === "POST") {
        const comment = {
          id: state.comments.length + 10,
          body: body.comment.body,
          createdAt: "2026-10-04T02:00:00Z",
          updatedAt: "2026-10-04T02:00:00Z",
          author: { ...state.user, following: false },
        };
        state.comments.unshift(comment);
        return send({ comment });
      }
      if (method === "DELETE") {
        state.comments = state.comments.filter(
          (c) => c.id !== Number(path.split("/").at(-1)),
        );
        return send({});
      }
      return send({ comments: state.comments });
    }
    if (method === "DELETE") {
      state.articles = state.articles.filter((a) => a !== article);
      return send({});
    }
    if (method === "PUT") {
      Object.assign(article, body.article, { slug: `${article.slug}-edited` });
    }
    return send({
      article: {
        ...article,
        author: { ...article.author, following: state.following },
      },
    });
  });
  return state;
}
export const test = base.extend<{ api: Awaited<ReturnType<typeof mockApi>> }>({
  api: [
    async ({ page }, use) => {
      const state = await mockApi(page);
      await use(state);
    },
    { auto: true },
  ],
});
export { expect };
export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email", { exact: true }).fill(testUser.email);
  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".navbar")).toContainText("reader");
}
