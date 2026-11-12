import type { Match } from "@mnjs/router";
import type { FeedQuery } from "../shared/types";
export type Route =
  | { kind: "home"; key: string; feed: FeedQuery }
  | { kind: "profile"; key: string; username: string; feed: FeedQuery }
  | { kind: "article"; key: string; slug: string }
  | { kind: "editor"; key: string; slug?: string }
  | { kind: "login" | "register" | "settings" | "missing"; key: string };
export const routes = {
  "/": { name: "home" },
  "/tag/:tag": { name: "tag" },
  "/profile/:username": { name: "profile" },
  "/profile/:username/favorites": { name: "favorites" },
  "/article/:slug": { name: "article" },
  "/editor": { name: "editor" },
  "/editor/:slug": { name: "edit" },
  "/login": { name: "login" },
  "/register": { name: "register" },
  "/settings": { name: "settings" },
};

export function routeFor(match: Match | null, url: URL): Route {
  const value = Number(url.searchParams.get("page") || 1);
  const page = Number.isSafeInteger(value) && value > 0 ? value : 1;
  const params = match?.params ?? {};
  switch (match?.name) {
    case "home":
    case "tag":
      return {
        kind: "home",
        key: "home",
        feed: {
          page,
          ...(match.name === "tag"
            ? { tag: params.tag }
            : { following: url.searchParams.get("feed") === "following" }),
        },
      };
    case "profile":
    case "favorites":
      return {
        kind: "profile",
        key: `profile:${params.username}`,
        username: params.username,
        feed: {
          page,
          ...(match.name === "favorites"
            ? { favorited: params.username }
            : { author: params.username }),
        },
      };
    case "article":
      return { kind: "article", key: url.pathname, slug: params.slug };
    case "editor":
    case "edit":
      return { kind: "editor", key: url.pathname, slug: params.slug };
    case "login":
    case "register":
    case "settings":
      return { kind: match.name, key: match.name };
    default:
      return { kind: "missing", key: url.pathname };
  }
}
export function pageHref(page: number, current = window.location.href) {
  const url = new URL(current);
  url.searchParams.set("page", String(page));
  return url.pathname + url.search;
}

export function requiresUser(route: Route): boolean {
  return (
    route.kind === "editor" ||
    route.kind === "settings" ||
    (route.kind === "home" && !!route.feed.following)
  );
}
