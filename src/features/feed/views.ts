import { CollectionView, View } from "marionette";
import { Model } from "@mnjs/data";
import { html } from "lit-html";
import type { ArticleSummary, Status } from "../../shared/types";
import {
  articlePath,
  authorMeta,
  errorsTemplate,
} from "../../shared/presentation";
import { pageHref } from "../../app/routes";

export const ArticleRow = View.extend({
  className: "article-preview",
  initialize(_options: {
    model: Model<ArticleSummary & { pending?: boolean; errors?: string[] }>;
  }) {},
  modelEvents: { change: "render" },
  template: (a: ArticleSummary & { pending?: boolean; errors?: string[] }) =>
    html`<div class="article-meta">
        ${authorMeta(a.author, a.createdAt)}<button
          class="favorite btn btn-sm pull-xs-right ${a.favorited
            ? "btn-primary"
            : "btn-outline-primary"}"
          ?disabled=${a.pending}
          aria-label=${`${a.favorited ? "Unfavorite" : "Favorite"} ${a.title}`}
          aria-pressed=${a.favorited}
        >
          <i class="ion-heart" aria-hidden="true"></i> ${a.favoritesCount}
        </button>
      </div>
      ${errorsTemplate(a.errors ?? [])}
      <a class="preview-link" href=${articlePath(a.slug)}
        ><h1>${a.title}</h1>
        <p>${a.description}</p>
        <span>Read more...</span>
        <ul class="tag-list">
          ${a.tagList.map(
            (tag) =>
              html`<li class="tag-default tag-pill tag-outline">${tag}</li>`,
          )}
        </ul></a
      >`,
  triggers: { "click .favorite": "favorite" },
});
export const EmptyFeed = View.extend({
  className: "empty-feed-message article-preview",
  template: () => html`No articles here... yet.`,
});
export const ArticleList = CollectionView.extend({
  childView: ArticleRow,
  emptyView: EmptyFeed,
  childViewTriggers: { favorite: "favorite" },
});
export const FeedLayout = View.extend({
  initialize(_options: { model: Model<Status> }) {},
  modelEvents: { "change:pending": "updatePending" },
  template: () =>
    html`<div class="feed-status"></div>
      <div class="feed-articles"></div>
      <div class="feed-pages"></div>`,
  regions: {
    status: ".feed-status",
    articles: ".feed-articles",
    pages: ".feed-pages",
  },
  childViewTriggers: { retry: "retry", favorite: "favorite" },
  onRender() {
    this.updatePending();
  },
  updatePending() {
    const pending = !!this.options.model.get("pending");
    this.el.querySelectorAll(".feed-articles, .feed-pages").forEach((el) => {
      el.toggleAttribute("hidden", pending);
    });
  },
});
export const FeedStatus = View.extend({
  modelEvents: { change: "render" },
  template: ({ pending, errors }: Status) =>
    html`${pending
      ? html`<div class="article-preview" role="status">
          Loading articles...
        </div>`
      : ""}${errorsTemplate(errors)}${errors.length
      ? html`<button class="retry btn btn-outline-primary">Retry</button>`
      : ""}`,
  triggers: { "click .retry": "retry" },
});
export const Pagination = View.extend({
  template: ({ count, page }: { count: number; page: number }) =>
    html`<nav aria-label="Article pages">
      <ul class="pagination">
        ${Array.from(
          { length: Math.ceil(count / 20) },
          (_, i) =>
            html`<li class="page-item ${page === i + 1 ? "active" : ""}">
              <a
                class="page-link"
                aria-current=${page === i + 1 ? "page" : "false"}
                href=${pageHref(i + 1)}
                >${i + 1}</a
              >
            </li>`,
        )}
      </ul>
    </nav>`,
});
