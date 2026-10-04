import { View } from "marionette";
import { html } from "lit-html";
import type { FeedQuery } from "../../shared/types";
import { segment } from "../../shared/api";
export const HomeLayout = View.extend({
  className: "home-page",
  template: () =>
    html`<div class="banner">
        <div class="container">
          <h1 class="logo-font" tabindex="-1">conduit</h1>
          <p>A place to share your knowledge.</p>
        </div>
      </div>
      <div class="container page">
        <div class="row">
          <div class="col-xs-12 col-md-9">
            <div class="tabs"></div>
            <div class="feed"></div>
          </div>
          <div class="col-xs-12 col-md-3">
            <div class="sidebar">
              <p>Popular Tags</p>
              <div class="tags"></div>
            </div>
          </div>
        </div>
      </div>`,
  regions: { tabs: ".tabs", feed: ".feed", tags: ".tags" },
});
export const HomeTabs = View.extend({
  modelEvents: { change: "render" },
  template: ({
    tag,
    following,
    authenticated,
  }: FeedQuery & { authenticated: boolean }) =>
    html`<div class="feed-toggle">
      <ul class="nav nav-pills outline-active">
        ${authenticated
          ? html`<li class="nav-item">
              <a
                class="nav-link ${following ? "active" : ""}"
                href="/?feed=following"
                >Your Feed</a
              >
            </li>`
          : ""}
        <li class="nav-item">
          <a class="nav-link ${!following && !tag ? "active" : ""}" href="/"
            >Global Feed</a
          >
        </li>
        ${tag
          ? html`<li class="nav-item">
              <a class="nav-link active" href=${`/tag/${segment(tag)}`}
                ># ${tag}</a
              >
            </li>`
          : ""}
      </ul>
    </div>`,
});
export const TagsView = View.extend({
  template: ({ tags }: { tags: string[] }) =>
    html`<div class="tag-list">
      ${tags.map(
        (tag) =>
          html`<a class="tag-pill tag-default" href=${`/tag/${segment(tag)}`}
            >${tag}</a
          >`,
      )}
    </div>`,
});
