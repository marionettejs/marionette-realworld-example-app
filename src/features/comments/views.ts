import { CollectionView, View, type DelegatedEvent } from "marionette";
import { Model } from "@mnjs/data";
import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import type { Comment, Status } from "../../shared/types";
import { avatar, errorsTemplate, profilePath } from "../../shared/presentation";
export const CommentsLayout = View.extend({
  template: () =>
    html`<div class="comment-compose"></div>
      <div class="comment-list"></div>`,
  regions: { compose: ".comment-compose", list: ".comment-list" },
  childViewTriggers: { submit: "comment:submit", remove: "comment:remove" },
});
export const CommentRow = View.extend({
  className: "card",
  initialize(_options: {
    model: Model<Comment>;
    username?: string;
    state: Model<ComposeState>;
  }) {},
  stateEvents: { "change:pending": "render" },
  templateContext() {
    return {
      pending: this.options.state.get("pending"),
      own: this.options.model.get("author")?.username === this.options.username,
    };
  },
  template: (c: Comment & { own: boolean; pending: boolean }) =>
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
              ><button
                class="delete-comment"
                aria-label="Delete comment"
                ?disabled=${c.pending}
              >
                <i class="ion-trash-a" aria-hidden="true"></i></button
            ></span>`
          : ""}
      </div>`,
  triggers: { "click .delete-comment": "remove" },
});
export const CommentList = CollectionView.extend({
  initialize(_options: { username?: string; state: Model<ComposeState> }) {},
  childView: CommentRow,
  childViewOptions() {
    return { username: this.options.username, state: this.options.state };
  },
  childViewTriggers: { remove: "remove" },
});
export type ComposeState = Status & {
  body: string;
  username?: string;
  image?: string | null;
};
export const CommentForm = View.extend({
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
