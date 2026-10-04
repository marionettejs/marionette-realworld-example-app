import type {
  Article,
  ArticleSummary,
  Comment,
  Draft,
  Profile,
  User,
  FeedQuery,
} from "./types";
export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: string[],
  ) {
    super(errors.join(". "));
  }
}
export const apiBase = (
  import.meta.env.VITE_API_URL || "https://api.realworld.show/api"
).replace(/\/$/, "");
export function errorMessages(error: unknown): string[] {
  return error instanceof ApiError
    ? error.errors
    : [
        error instanceof Error
          ? error.message
          : "Something went wrong. Please retry.",
      ];
}
// Narrow JSON at the transport boundary. UI never trusts a type assertion alone.
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid API response");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid API text");
  return value;
}
function nullable(value: unknown): string | null {
  return value == null ? null : string(value);
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid API flag");
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Invalid API number");
  return value;
}
function array<T>(value: unknown, parse: (entry: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Invalid API list");
  return value.map(parse);
}
function profile(value: unknown): Profile {
  const p = record(value);
  return {
    username: string(p.username),
    bio: nullable(p.bio),
    image: nullable(p.image),
    following: boolean(p.following),
  };
}
function user(value: unknown): User {
  const u = record(value);
  return {
    username: string(u.username),
    email: string(u.email),
    token: string(u.token),
    bio: nullable(u.bio),
    image: nullable(u.image),
  };
}
function articleSummary(value: unknown): ArticleSummary {
  const a = record(value);
  return {
    slug: string(a.slug),
    title: string(a.title),
    description: string(a.description),
    tagList: array(a.tagList, string),
    createdAt: string(a.createdAt),
    updatedAt: string(a.updatedAt),
    favorited: boolean(a.favorited),
    favoritesCount: number(a.favoritesCount),
    author: profile(a.author),
  };
}
function article(value: unknown): Article {
  return { ...articleSummary(value), body: string(record(value).body) };
}
function comment(value: unknown): Comment {
  const c = record(value);
  return {
    id: number(c.id),
    body: string(c.body),
    createdAt: string(c.createdAt),
    updatedAt: string(c.updatedAt),
    author: profile(c.author),
  };
}
export const segment = encodeURIComponent;
export class Api {
  constructor(
    private credentials: (write: boolean) => {
      token: string | null;
      signal: AbortSignal;
    },
    private unauthorized: () => void,
  ) {}
  async request(
    path: string,
    signal: AbortSignal,
    method = "GET",
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const { token, signal: credentialsSignal } = this.credentials(
      method !== "GET" && path !== "/users" && path !== "/users/login",
    );
    signal = AbortSignal.any([signal, credentialsSignal]);
    const response = await fetch(`${apiBase}${path}`, {
      signal,
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const raw: unknown =
      response.status === 204 ? {} : await response.json().catch(() => ({}));
    signal.throwIfAborted();
    if (token !== this.credentials(false).token)
      throw new DOMException("Session changed. Please retry.", "AbortError");
    if (!response.ok) {
      if (response.status === 401 && token) this.unauthorized();
      const errors = record(raw).errors;
      const messages =
        errors && typeof errors === "object"
          ? Object.entries(errors).flatMap(([field, values]) =>
              (Array.isArray(values) ? values : [values]).map(
                (value) => `${field} ${String(value)}`,
              ),
            )
          : [`Request failed (${response.status}). Please retry.`];
      throw new ApiError(response.status, messages);
    }
    return record(raw);
  }
  async current(signal: AbortSignal) {
    return user((await this.request("/user", signal)).user);
  }
  async authenticate(
    mode: "login" | "register",
    fields: Record<string, string>,
    signal: AbortSignal,
  ) {
    return user(
      (
        await this.request(
          mode === "login" ? "/users/login" : "/users",
          signal,
          "POST",
          { user: fields },
        )
      ).user,
    );
  }
  async updateUser(fields: Record<string, string>, signal: AbortSignal) {
    return user(
      (await this.request("/user", signal, "PUT", { user: fields })).user,
    );
  }
  async articles(query: FeedQuery, signal: AbortSignal) {
    const params = new URLSearchParams({
      limit: "20",
      offset: String((query.page - 1) * 20),
    });
    for (const key of ["tag", "author", "favorited"] as const)
      if (query[key]) params.set(key, query[key]);
    const data = await this.request(
      `/articles${query.following ? "/feed" : ""}?${params}`,
      signal,
    );
    return {
      articles: array(data.articles, articleSummary),
      articlesCount: number(data.articlesCount),
    };
  }
  async tags(signal: AbortSignal) {
    return array((await this.request("/tags", signal)).tags, string);
  }
  async article(slug: string, signal: AbortSignal) {
    return article(
      (await this.request(`/articles/${segment(slug)}`, signal)).article,
    );
  }
  async saveArticle(
    slug: string | undefined,
    draft: Draft,
    signal: AbortSignal,
  ) {
    return article(
      (
        await this.request(
          `/articles${slug ? `/${segment(slug)}` : ""}`,
          signal,
          slug ? "PUT" : "POST",
          { article: draft },
        )
      ).article,
    );
  }
  async deleteArticle(slug: string, signal: AbortSignal) {
    await this.request(`/articles/${segment(slug)}`, signal, "DELETE");
  }
  async favorite(value: ArticleSummary, signal: AbortSignal) {
    return article(
      (
        await this.request(
          `/articles/${segment(value.slug)}/favorite`,
          signal,
          value.favorited ? "DELETE" : "POST",
        )
      ).article,
    );
  }
  async profile(username: string, signal: AbortSignal) {
    return profile(
      (await this.request(`/profiles/${segment(username)}`, signal)).profile,
    );
  }
  async follow(value: Profile, signal: AbortSignal) {
    return profile(
      (
        await this.request(
          `/profiles/${segment(value.username)}/follow`,
          signal,
          value.following ? "DELETE" : "POST",
        )
      ).profile,
    );
  }
  async comments(slug: string, signal: AbortSignal) {
    return array(
      (await this.request(`/articles/${segment(slug)}/comments`, signal))
        .comments,
      comment,
    );
  }
  async addComment(slug: string, body: string, signal: AbortSignal) {
    return comment(
      (
        await this.request(
          `/articles/${segment(slug)}/comments`,
          signal,
          "POST",
          { comment: { body } },
        )
      ).comment,
    );
  }
  async deleteComment(slug: string, id: number, signal: AbortSignal) {
    await this.request(
      `/articles/${segment(slug)}/comments/${id}`,
      signal,
      "DELETE",
    );
  }
}
