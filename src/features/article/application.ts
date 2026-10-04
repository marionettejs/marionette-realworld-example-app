import {
  Application,
  type ViewInstance,
  type LifecycleContext,
} from "marionette";
import { Model } from "@mnjs/data";
import type { Article, Status } from "../../shared/types";
import { errorMessages } from "../../shared/api";
import { Operation } from "../../shared/operation";
import { requireUser, type Context } from "../../app/session";
import { CommentsApplication } from "../comments/application";
import { ErrorView, LoadingView } from "../../shared/views";
import {
  ArticleLayout,
  ArticleHeading,
  ArticleBody,
  ArticleMeta,
} from "./views";
export class ArticleApplication extends Application {
  article = new Model<Article & Status & { self: boolean }>();
  comments: CommentsApplication;
  operation = new Operation();
  constructor(readonly context: Context) {
    super();
    this.comments = this.addChildApp(
      "comments",
      new CommentsApplication(context),
    );
  }
  get viewEvents() {
    return {
      favorite: () => this.favorite(),
      follow: () => this.follow(),
      remove: () => this.remove(),
    };
  }
  prepareStart({ slug }: { slug: string }, { signal }: LifecycleContext) {
    return this.context.session.api.article(slug, signal);
  }
  onStart(_app: unknown, _options: unknown, article: Article) {
    this.article.reset({
      ...article,
      pending: false,
      errors: [],
      self: article.author.username === this.context.session.user()?.username,
    });
    if (!this.getView()) {
      const layout = this.setView(new ArticleLayout());
      layout.showChildView(
        "heading",
        new ArticleHeading({ model: this.article }),
      );
      layout.showChildView("body", new ArticleBody({ model: this.article }));
      layout.showChildView("top", new ArticleMeta({ model: this.article }));
      layout.showChildView("bottom", new ArticleMeta({ model: this.article }));
    }
    this.showView();
    if (!this.comments.isRunning()) void this.openComments();
  }
  async openComments() {
    const region = (this.getView() as ViewInstance).getRegion("comments")!;
    region.show(new LoadingView());
    try {
      await this.comments.start({ region, slug: this.article.get("slug") });
    } catch (error) {
      if (
        !this.isRunning() ||
        region !== (this.getView() as ViewInstance)?.getRegion("comments")
      )
        return;
      this.comments.stop();
      const view = new ErrorView({
        model: { message: errorMessages(error).join(". ") },
      });
      this.listenTo(view, {
        retry: () => {
          void this.openComments();
        },
      });
      region.show(view);
    }
  }
  action<T>(
    work: (signal: AbortSignal) => Promise<T>,
    commit: (result: T) => void,
  ) {
    if (!requireUser(this.context) || this.article.get("pending")) return;
    this.article.set({ pending: true, errors: [] });
    void this.operation.run(work, commit, (error) =>
      this.article.set({ pending: false, errors: errorMessages(error) }),
    );
  }
  favorite() {
    this.action(
      (signal) =>
        this.context.session.api.favorite(
          this.article.toObject() as Article,
          signal,
        ),
      (article) => this.article.set({ ...article, pending: false }),
    );
  }
  follow() {
    this.action(
      (signal) =>
        this.context.session.api.follow(this.article.get("author")!, signal),
      (author) => this.article.set({ author, pending: false }),
    );
  }
  remove() {
    this.action(
      (signal) =>
        this.context.session.api.deleteArticle(
          this.article.get("slug")!,
          signal,
        ),
      () => this.context.navigate("/"),
    );
  }
  onBeforeStop() {
    this.operation.cancel();
  }
  onDestroy() {
    this.article.destroy();
  }
}
