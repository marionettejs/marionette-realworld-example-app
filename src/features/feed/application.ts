import {
  Application,
  type ViewInstance,
  type RegionInstance,
  type LifecycleContext,
} from "marionette";
import { Model, Collection } from "@mnjs/data";
import type { ArticleSummary, FeedQuery, Status } from "../../shared/types";
import { errorMessages } from "../../shared/api";
import { Operation } from "../../shared/operation";
import { requireUser, type Context } from "../../app/session";
import { pageHref } from "../../app/routes";
import { ErrorView, LoadingView } from "../../shared/views";

import {
  ArticleRow,
  ArticleList,
  FeedLayout,
  FeedStatus,
  Pagination,
} from "./views";
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
  private writes = new Map<Operation, Promise<void>>();
  private writeRevision = 0;
  private membershipChanged = false;
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
  async prepareStart({ query }: FeedStart, { signal }: LifecycleContext) {
    this.query = query;
    // Read after active writes; repeat if another write overlaps the response.
    // A query refresh must not cancel sibling favorite operations.
    while (true) {
      while (this.writes.size) {
        await Promise.all(this.writes.values());
        signal.throwIfAborted();
      }
      signal.throwIfAborted();
      const revision = this.writeRevision;
      const result = await this.context.session.api.articles(query, signal);
      signal.throwIfAborted();
      if (!this.writes.size && revision === this.writeRevision) return result;
    }
  }
  onStart(_app: unknown, { query }: FeedStart, result: FeedResult) {
    if (query.page > 1 && result.articles.length === 0) {
      this.context.navigate(
        pageHref(Math.max(1, Math.ceil(result.articlesCount / 20))),
        { replace: true },
      );
      return;
    }
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
    this.membershipChanged = false;
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
    if (this.isRunning()) return this.load(query);
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
  async favorite(
    model: Model<ArticleSummary & { pending?: boolean; errors?: string[] }>,
  ) {
    if (!requireUser(this.context)) return;
    if (model.get("pending")) return;
    const a = model.toObject() as ArticleSummary;
    const operation = new Operation();
    model.set({ pending: true, errors: [] });
    this.writeRevision++;
    const pending = operation.run(
      (signal) => this.context.session.api.favorite(a, signal),
      (result) => {
        model.set({ ...result, pending: false, errors: [] });
        if (this.query.favorited === this.context.session.user()?.username)
          this.membershipChanged = true;
      },
      (error) => {
        model.set({ pending: false, errors: errorMessages(error) });
      },
    );
    this.writes.set(operation, pending);
    await pending;
    this.writes.delete(operation);
    if (
      this.isRunning() &&
      !this.writes.size &&
      this.membershipChanged &&
      !this.getState().get("pending")
    )
      void this.load(this.query);
  }
  onBeforeStop() {
    this.writes.forEach((_pending, operation) => operation.cancel());
    this.writes.clear();
    this.membershipChanged = false;
  }
  onStop() {
    this.articles.reset();
  }
  onDestroy() {
    this.articles.destroy();
  }
}
