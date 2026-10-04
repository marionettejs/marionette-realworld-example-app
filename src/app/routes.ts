import type { FeedQuery } from "../shared/types";
export type Route =
  | { kind: "home"; key: string; feed: FeedQuery }
  | { kind: "profile"; key: string; username: string; feed: FeedQuery }
  | { kind: "article"; key: string; slug: string }
  | { kind: "editor"; key: string; slug?: string }
  | { kind: "login" | "register" | "settings" | "missing"; key: string };
export function parseRoute(url: URL): Route {
  let parts: string[];
  try {
    parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return { kind: "missing", key: url.pathname };
  }
  const value = Number(url.searchParams.get("page") || 1);
  const page = Number.isSafeInteger(value) && value > 0 ? value : 1;
  if (!parts.length || (parts[0] === "tag" && parts.length === 2))
    return {
      kind: "home",
      key: "home",
      feed: {
        page,
        ...(parts[1]
          ? { tag: parts[1] }
          : { following: url.searchParams.get("feed") === "following" }),
      },
    };
  if (
    parts[0] === "profile" &&
    (parts.length === 2 || (parts.length === 3 && parts[2] === "favorites"))
  )
    return {
      kind: "profile",
      key: `profile:${parts[1]}`,
      username: parts[1],
      feed: {
        page,
        ...(parts[2] ? { favorited: parts[1] } : { author: parts[1] }),
      },
    };
  if (parts[0] === "article" && parts.length === 2)
    return { kind: "article", key: url.pathname, slug: parts[1] };
  if (parts[0] === "editor" && parts.length <= 2)
    return { kind: "editor", key: url.pathname, slug: parts[1] };
  if (
    parts.length === 1 &&
    ["login", "register", "settings"].includes(parts[0])
  )
    return {
      kind: parts[0] as "login" | "register" | "settings",
      key: parts[0],
    };
  return { kind: "missing", key: url.pathname };
}
export function pageHref(page: number, current = window.location.href) {
  const url = new URL(current);
  url.searchParams.set("page", String(page));
  return url.pathname + url.search;
}
