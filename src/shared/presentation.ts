import { html } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Profile } from "./types";
import { segment } from "./api";
export function avatar(url: string | null | undefined) {
  if (!url) return "/default-avatar.svg";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.href
      : "/default-avatar.svg";
  } catch {
    return "/default-avatar.svg";
  }
}
export const profilePath = (username: string) =>
  `/profile/${segment(username)}`;
export const articlePath = (slug: string) => `/article/${segment(slug)}`;
export function authorMeta(author: Profile, date: string) {
  return html`<a href=${profilePath(author.username)}
      ><img src=${avatar(author.image)} alt=""
    /></a>
    <div class="info">
      <a class="author" href=${profilePath(author.username)}
        >${author.username}</a
      ><span class="date"
        >${new Date(date).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}</span
      >
    </div>`;
}
export const markdown = (body: string) =>
  unsafeHTML(
    DOMPurify.sanitize(marked.parse(body, { async: false }), {
      USE_PROFILES: { html: true },
    }),
  );
export const errorsTemplate = (errors: string[] = []) =>
  html`<ul class="error-messages" role="alert">
    ${errors.map((error) => html`<li>${error}</li>`)}
  </ul>`;
