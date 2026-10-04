import {
  Application,
  CollectionView,
  View,
  type DelegatedEvent,
  type LifecycleContext,
} from "marionette";
import { Model, Collection } from "@mnjs/data";
import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import type { Context } from "../app/session";
import type { Comment, Status } from "../shared/types";
import { avatar, errorsTemplate, profilePath } from "../shared/presentation";
import { errorMessages } from "../shared/api";
import { Operation } from "../shared/operation";
const CommentsLayout = View.extend({
  template: () =>
    html`<div class="comment-compose"></div>
      <div class="comment-list"></div>`,
  regions: { compose: ".comment-compose", list: ".comment-list" },
  childViewTriggers: { submit: "comment:submit", remove: "comment:remove" },
});
const CommentRow = View.extend({
  className: "card",
  initialize(_options: { model: Model<Comment>; username?: string }) {},
  templateContext() {
    return {
      own: this.options.model.get("author")?.username === this.options.username,
    };
  },
  template: (c: Comment & { own: boolean }) =>
    html`<div class="card-block"><p class="card-text">${c.body}</p></div>
      <div class="card-footer">
        <a href=${profilePath(c.author.username)} class="comment-author"
          ><img src=${avatar(c.author.image)} class="comment-author-img" alt=""
        /></a>
        <a class="comment-author" href=${profilePath(c.author.username)}
          >${c.author.username}</a
        ><span class="date-posted"
          >${new Date(c.createdAt).toLocaleDateString()}</span
        >${c.own
          ? html`<span class="mod-options"
              ><button class="delete-comment" aria-label="Delete comment">
                <i class="ion-trash-a" aria-hidden="true"></i></button
            ></span>`
          : ""}
      </div>`,
  triggers: { "click .delete-comment": "remove" },
});
const CommentList = CollectionView.extend({
  initialize(_options: { username?: string }) {},
  childView: CommentRow,
  childViewOptions() {
    return { username: this.options.username };
  },
  childViewTriggers: { remove: "remove" },
});
type ComposeState = Status & {
  body: string;
  username?: string;
  image?: string | null;
};
const CommentForm = View.extend({
  initialize(_options: { model: Model<ComposeState> }) {},
  modelEvents: { change: "render" },
  template: ({ username, image, body, pending, errors }: ComposeState) =>
    html`${errorsTemplate(errors)}${username
      ? html`<form class="card comment-form">
          <div class="card-block">
            <label class="sr-only" for="comment-body">Write a comment...</label
            ><textarea
              id="comment-body"
              class="form-control"
              placeholder="Write a comment..."
              rows="3"
              required
              .value=${live(body)}
            ></textarea>
          </div>
          <div class="card-footer">
            <img
              class="comment-author-img"
              src=${avatar(image)}
              alt=""
            /><button class="btn btn-sm btn-primary" ?disabled=${pending}>
              Post Comment
            </button>
          </div>
        </form>`
      : html`<p>
          <a href="/login">Sign in</a> or <a href="/register">sign up</a> to add
          comments on this article.
        </p>`}`,
  events: { "input textarea": "edit", "submit form": "submit" },
  edit(event: DelegatedEvent) {
    this.options.model.set(
      "body",
      (event.delegateTarget as HTMLTextAreaElement).value,
    );
  },
  submit(event: Event) {
    event.preventDefault();
    this.trigger("submit");
  },
});
export class CommentsApplication extends Application {
  createState() {
    return new Model<ComposeState>({ body: "", pending: false, errors: [] });
  }
  getState() {
    return super.getState() as Model<ComposeState>;
  }
  comments = new Collection<Model<Comment>>();
  operation = new Operation();
  slug = "";
  constructor(readonly context: Context) {
    super();
  }
  get viewEvents() {
    return {
      "comment:submit": () => this.submit(),
      "comment:remove": (row: InstanceType<typeof CommentRow>) =>
        this.remove(row.options.model),
    };
  }
  prepareStart({ slug }: { slug: string }, { signal }: LifecycleContext) {
    return this.context.session.api.comments(slug, signal);
  }
  onStart(_app: unknown, { slug }: { slug: string }, comments: Comment[]) {
    this.slug = slug;
    const user = this.context.session.user();
    this.getState().set({
      body: "",
      pending: false,
      errors: [],
      username: user?.username,
      image: user?.image,
    });
    this.comments.reset(comments);
    const layout = this.setView(new CommentsLayout());
    layout.showChildView(
      "compose",
      new CommentForm({ model: this.getState() }),
    );
    layout.showChildView(
      "list",
      new CommentList({ collection: this.comments, username: user?.username }),
    );
    this.showView();
  }
  submit() {
    const body = this.getState().get("body") || "";
    if (!body.trim() || this.getState().get("pending")) return;
    this.getState().set({ pending: true, errors: [] });
    void this.operation.run(
      (signal) => this.context.session.api.addComment(this.slug, body, signal),
      (comment) => {
        this.comments.add(comment, { at: 0 });
        this.getState().set({
          pending: false,
          ...(body === this.getState().get("body") ? { body: "" } : {}),
        });
      },
      (error) =>
        this.getState().set({ pending: false, errors: errorMessages(error) }),
    );
  }
  remove(model: Model<Comment>) {
    if (this.getState().get("pending")) return;
    this.getState().set({ pending: true, errors: [] });
    void this.operation.run(
      (signal) =>
        this.context.session.api.deleteComment(
          this.slug,
          model.get("id")!,
          signal,
        ),
      () => {
        this.comments.remove(model);
        this.getState().set("pending", false);
      },
      (error) =>
        this.getState().set({ pending: false, errors: errorMessages(error) }),
    );
  }
  onBeforeStop() {
    this.operation.cancel();
  }
  onStop() {
    this.comments.reset();
    this.getState().set("body", "");
  }
  onDestroy() {
    this.comments.destroy();
  }
}
