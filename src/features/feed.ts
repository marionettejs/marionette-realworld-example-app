import {
  Application,
  type ViewInstance,
  type RegionInstance,
  CollectionView,
  View,
  type LifecycleContext,
} from "marionette";
import { Model, Collection } from "@mnjs/data";
import { html } from "lit-html";
import type { ArticleSummary, FeedQuery, Status } from "../shared/types";
import {
  articlePath,
  authorMeta,
  errorsTemplate,
} from "../shared/presentation";
import { errorMessages } from "../shared/api";
import { Operation } from "../shared/operation";
import { requireUser, type Context } from "../app/session";
import { pageHref } from "../app/routes";
import { ErrorView, LoadingView } from "../shared/views";

export const ArticleRow = View.extend({
  className: "article-preview",
  initialize(_options: {
    model: Model<ArticleSummary & { pending?: boolean }>;
  }) {},
  modelEvents: { change: "render" },
  template: (a: ArticleSummary & { pending?: boolean }) =>
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
const EmptyFeed = View.extend({
  className: "empty-feed-message article-preview",
  template: () => html`No articles here... yet.`,
});
export const ArticleList = CollectionView.extend({
  childView: ArticleRow,
  emptyView: EmptyFeed,
  childViewTriggers: { favorite: "favorite" },
});
const FeedLayout = View.extend({
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
});
const FeedStatus = View.extend({
  modelEvents: { change: "render" },
  template: ({ pending, errors }: Status) =>
    html`${pending
      ? html`<p role="status">Loading articles…</p>`
      : ""}${errorsTemplate(errors)}${errors.length
      ? html`<button class="retry btn btn-outline-primary">Retry</button>`
      : ""}`,
  triggers: { "click .retry": "retry" },
});
const Pagination = View.extend({
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
type FeedStart = { query: FeedQuery };
type FeedResult = { articles: ArticleSummary[]; articlesCount: number };
export class FeedApplication extends Application {
  createState() {
    return new Model<Status>({ pending: false, errors: [] });
  }
  getState() {
    return super.getState() as Model<Status>;
  }
  constructor(readonly context: Context) {
    super();
  }
  articles = new Collection<Model<ArticleSummary>>();
  query: FeedQuery = { page: 1 };
  operations = new Map<string, Operation>();
  get viewEvents() {
    return {
      retry: () => this.load(this.query),
      favorite: (row: InstanceType<typeof ArticleRow>) =>
        this.favorite(row.options.model),
    };
  }
  onBeforeStart() {
    this.getState().set({ pending: true, errors: [] });
    if (!this.isRunning()) this.showView(new LoadingView());
  }
  prepareStart({ query }: FeedStart, { signal }: LifecycleContext) {
    this.query = query;
    return this.context.session.api.articles(query, signal);
  }
  onStart(_app: unknown, { query }: FeedStart, result: FeedResult) {
    if (!(this.getView() instanceof FeedLayout)) {
      const layout = this.setView(new FeedLayout());
      layout.showChildView(
        "status",
        new FeedStatus({ model: this.getState() }),
      );
      layout.showChildView(
        "articles",
        new ArticleList({ collection: this.articles }),
      );
    }
    // New membership ends the outgoing rows' write authority.
    this.cancelFavorites();
    this.articles.reset(result.articles);
    this.getState().set({ pending: false, errors: [] });
    (this.getView() as ViewInstance).showChildView(
      "pages",
      new Pagination({
        model: { count: result.articlesCount, page: query.page },
      }),
    );
    this.showView();
  }
  async open(region: RegionInstance, query: FeedQuery) {
    try {
      await this.start({ region, query });
    } catch (error) {
      this.showFailure(error);
    }
  }
  showFailure(error: unknown) {
    if (this.isRunning())
      this.getState().set({ pending: false, errors: errorMessages(error) });
    else {
      this.stop();
      this.showView(
        new ErrorView({ model: { message: errorMessages(error).join(". ") } }),
      );
    }
  }
  async load(query: FeedQuery) {
    try {
      await this.restart({ query });
    } catch (error) {
      this.showFailure(error);
    }
  }
  async favorite(model: Model<ArticleSummary & { pending?: boolean }>) {
    if (!requireUser(this.context)) return;
    const a = model.toObject() as ArticleSummary;
    const operation = this.operations.get(a.slug) ?? new Operation();
    this.operations.set(a.slug, operation);
    model.set("pending", true);
    await operation.run(
      (signal) => this.context.session.api.favorite(a, signal),
      (result) => {
        model.set({ ...result, pending: false });
      },
      (error) => {
        model.set("pending", false);
        this.getState().set("errors", errorMessages(error));
      },
    );
  }
  cancelFavorites() {
    this.operations.forEach((operation) => operation.cancel());
    this.operations.clear();
  }
  onBeforeStop() {
    this.cancelFavorites();
  }
  onStop() {
    this.articles.reset();
  }
  onDestroy() {
    this.articles.destroy();
  }
}
