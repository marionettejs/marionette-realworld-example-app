import { Application, type LifecycleContext } from "marionette";
import { Model, Collection } from "@mnjs/data";
import type { Context } from "../../app/session";
import type { Comment } from "../../shared/types";
import { errorMessages } from "../../shared/api";
import { Operation } from "../../shared/operation";
import {
  CommentsLayout,
  CommentRow,
  CommentList,
  CommentForm,
  type ComposeState,
} from "./views";
export class CommentsApplication extends Application {
  createState() {
    return new Model<ComposeState>({ body: "", pending: false, errors: [] });
  }
  declare getState: () => Model<ComposeState>;
  comments = new Collection<Model<Comment>>();
  operation = new Operation();
  slug = "";
  constructor(readonly context: Context) {
    super();
  }
  get viewEvents() {
    return {
      "comment:submit": "submit",
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
      pending: false,
      errors: [],
      username: user?.username,
      image: user?.image,
    });
    this.comments.reset(comments);
    if (!this.getView()) {
      const layout = this.setView(new CommentsLayout());
      layout.showChildView(
        "compose",
        new CommentForm({ model: this.getState() }),
      );
      layout.showChildView(
        "list",
        new CommentList({
          collection: this.comments,
          username: user?.username,
          state: this.getState(),
        }),
      );
    }
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
