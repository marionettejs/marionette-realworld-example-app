import type { ApplicationRoutes } from "@mnjs/router";
// This table owns placement only; each mounted feature owns its leaf URLs.
export const pageRoutes: ApplicationRoutes = [
  { path: "/", mount: "home", region: "content" },
  { path: "/profile/:username", mount: "profile", region: "content" },
  { path: "/article/:slug", mount: "article", region: "content" },
  { path: "/editor", mount: "editor", region: "content" },
  { path: "/", mount: "auth", region: "content" },
  { path: "/settings", mount: "settings", region: "content" },
  { path: "/404", name: "missing", handler: "showMissing" },
];
export function feedPage(query: URLSearchParams): number {
  const value = Number(query.get("page") || 1);
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
export function pageHref(page: number, current = window.location.href) {
  const url = new URL(current);
  url.searchParams.set("page", String(page));
  return url.pathname + url.search;
}
