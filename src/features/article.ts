import {
  Application,
  type ViewInstance,
  View,
  type LifecycleContext,
} from "marionette";
import { Model } from "@mnjs/data";
import { html } from "lit-html";
import type { Article, Status } from "../shared/types";
import { authorMeta, errorsTemplate, markdown } from "../shared/presentation";
import { errorMessages, segment } from "../shared/api";
import { Operation } from "../shared/operation";
import { requireUser, type Context } from "../app/session";
import { CommentsApplication } from "./comments";
import { ErrorView, LoadingView } from "../shared/views";
const ArticleLayout = View.extend({
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
const ArticleHeading = View.extend({
  template: ({ title }: Article) => html`<h1 tabindex="-1">${title}</h1>`,
});
const ArticleBody = View.extend({
  template: ({ body, tagList }: Article) =>
    html`<div class="row article-content">
        <div class="col-md-12">${markdown(body)}</div>
      </div>
      <ul class="tag-list">
        ${tagList.map(
          (tag) =>
            html`<li class="tag-default tag-pill tag-outline">
              <a href=${`/tag/${segment(tag)}`}>${tag}</a>
            </li>`,
        )}
      </ul>`,
});
const ArticleMeta = View.extend({
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
    const layout = this.setView(new ArticleLayout());
    layout.showChildView(
      "heading",
      new ArticleHeading({ model: this.article }),
    );
    layout.showChildView("body", new ArticleBody({ model: this.article }));
    layout.showChildView("top", new ArticleMeta({ model: this.article }));
    layout.showChildView("bottom", new ArticleMeta({ model: this.article }));
    this.showView();
    void this.openComments();
  }
  async openComments() {
    const region = (this.getView() as ViewInstance).getRegion("comments")!;
    region.show(new LoadingView());
    try {
      await this.comments.start({ region, slug: this.article.get("slug") });
    } catch (error) {
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
    void this.operation.run(
      work,
      (result) => {
        this.article.set("pending", false);
        commit(result);
      },
      (error) =>
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
      (article) => this.article.set(article),
    );
  }
  follow() {
    this.action(
      (signal) =>
        this.context.session.api.follow(this.article.get("author")!, signal),
      (author) => this.article.set("author", author),
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
