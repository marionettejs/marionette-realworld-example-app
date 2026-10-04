import { Application, View, type LifecycleContext } from "marionette";
import { html } from "lit-html";
import { Model } from "@mnjs/data";
import { FeedApplication } from "./feed";
import type { Context } from "../app/session";
import type { FeedQuery } from "../shared/types";
import { segment } from "../shared/api";
const HomeLayout = View.extend({
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
const HomeTabs = View.extend({
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
const TagsView = View.extend({
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
export class HomeApplication extends Application {
  feed: FeedApplication;
  tabs = new Model<FeedQuery & { authenticated: boolean }>({
    page: 1,
    authenticated: false,
  });
  constructor(readonly context: Context) {
    super();
    this.feed = this.addChildApp("feed", new FeedApplication(context));
  }
  prepareStart(_options: unknown, { signal }: LifecycleContext) {
    return this.context.session.api.tags(signal);
  }
  onStart(_app: unknown, { query }: { query: FeedQuery }, tags: string[]) {
    const layout = this.setView(new HomeLayout());
    layout.showChildView("tabs", new HomeTabs({ model: this.tabs }));
    layout.showChildView("tags", new TagsView({ model: { tags } }));
    this.showView();
    // Parent readiness is tags/layout; the feed owns its independently retryable readiness.
    void this.feed.open(layout.getRegion("feed")!, query);
    this.tabs.reset({ ...query, authenticated: !!this.context.session.user() });
  }
  setQuery(query: FeedQuery) {
    this.tabs.reset({ ...query, authenticated: !!this.context.session.user() });
    void this.feed.load(query);
  }
  onDestroy() {
    this.tabs.destroy();
  }
}
