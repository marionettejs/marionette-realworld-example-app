import { View } from "marionette";
import { html } from "lit-html";
import type { Article, Status } from "../../shared/types";
import {
  authorMeta,
  errorsTemplate,
  markdown,
} from "../../shared/presentation";
import { segment } from "../../shared/api";
export const ArticleLayout = View.extend({
  className: "article-page",
  template: () =>
    html`<div class="banner">
        <div class="container">
          <div class="article-heading"></div>
          <div class="top-meta"></div>
        </div>
      </div>
      <div class="container page">
        <div class="article-body"></div>
        <hr />
        <div class="article-actions"><div class="bottom-meta"></div></div>
        <div class="row">
          <div class="col-xs-12 col-md-8 offset-md-2">
            <div class="comments"></div>
          </div>
        </div>
      </div>`,
  regions: {
    heading: ".article-heading",
    top: ".top-meta",
    body: ".article-body",
    bottom: ".bottom-meta",
    comments: ".comments",
  },
  childViewTriggers: {
    favorite: "favorite",
    follow: "follow",
    remove: "remove",
  },
});
export const ArticleHeading = View.extend({
  modelEvents: { "change:title": "render" },
  template: ({ title }: Article) => html`<h1 tabindex="-1">${title}</h1>`,
});
export const ArticleBody = View.extend({
  modelEvents: { change: "renderContent" },
  renderContent(
    _model: unknown,
    {
      changed,
      previous,
    }: { changed: Partial<Article>; previous: Partial<Article> },
  ) {
    const tags = changed.tagList;
    const tagsChanged =
      tags &&
      (tags.length !== previous.tagList?.length ||
        tags.some((tag, index) => tag !== previous.tagList?.[index]));
    if ("body" in changed || tagsChanged) this.render();
  },
  template: ({ body, tagList }: Article) =>
    html`<div class="row article-content">
      <div class="col-md-12">
        ${markdown(body)}
        <ul class="tag-list">
          ${tagList.map(
            (tag) =>
              html`<li>
                <a
                  class="tag-default tag-pill tag-outline"
                  href=${`/tag/${segment(tag)}`}
                  >${tag}</a
                >
              </li>`,
          )}
        </ul>
      </div>
    </div>`,
});
export const ArticleMeta = View.extend({
  className: "article-meta",
  modelEvents: { change: "render" },
  template: (a: Article & Status & { self: boolean }) =>
    html`${authorMeta(a.author, a.createdAt)}${a.self
      ? html`<a
            href=${`/editor/${segment(a.slug)}`}
            class="btn btn-sm btn-outline-secondary"
            ><i class="ion-edit" aria-hidden="true"></i> Edit Article</a
          >
          <button
            class="remove btn btn-sm btn-outline-danger"
            ?disabled=${a.pending}
          >
            <i class="ion-trash-a" aria-hidden="true"></i> Delete Article
          </button>`
      : html`<button
            class="follow btn btn-sm btn-outline-secondary"
            ?disabled=${a.pending}
            aria-pressed=${a.author.following}
          >
            <i class="ion-plus-round" aria-hidden="true"></i> ${a.author
              .following
              ? "Unfollow"
              : "Follow"}
            ${a.author.username}
          </button>
          <button
            class="favorite btn btn-sm ${a.favorited
              ? "btn-primary"
              : "btn-outline-primary"}"
            ?disabled=${a.pending}
            aria-pressed=${a.favorited}
          >
            <i class="ion-heart" aria-hidden="true"></i> ${a.favorited
              ? "Unfavorite"
              : "Favorite"}
            Article (${a.favoritesCount})
          </button>`}${errorsTemplate(a.errors)}`,
  triggers: {
    "click .favorite": "favorite",
    "click .follow": "follow",
    "click .remove": "remove",
  },
});
