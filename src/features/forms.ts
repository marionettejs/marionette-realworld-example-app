import { Application, type LifecycleContext } from "marionette";
import { Model } from "@mnjs/data";
import type { Context } from "../app/session";
import type { Article, Status } from "../shared/types";
import { FormView, type Fields } from "./form-view";
import { Operation } from "../shared/operation";
import { ApiError, errorMessages } from "../shared/api";
import { articlePath, profilePath } from "../shared/presentation";
abstract class FormApplication extends Application {
  createState() {
    return new Model<Status & { notice?: string }>({
      pending: false,
      errors: [],
    });
  }
  getState() {
    return super.getState() as Model<Status & { notice?: string }>;
  }
  fields = new Model<Fields>();
  operation = new Operation();
  constructor(readonly context: Context) {
    super();
  }
  get viewEvents() {
    return {
      submit: () => this.submit(),
      logout: () => {
        this.context.session.clear();
        this.context.navigate("/");
      },
    };
  }
  abstract submit(): void;
  save<T>(
    work: (signal: AbortSignal) => Promise<T>,
    commit: (value: T) => void,
  ) {
    if (this.getState().get("pending")) return;
    this.getState().set({ pending: true, errors: [], notice: "" });
    void this.operation.run(
      work,
      (value) => {
        this.getState().set("pending", false);
        commit(value);
      },
      (error) =>
        this.getState().set({ pending: false, errors: errorMessages(error) }),
    );
  }
  onBeforeStop() {
    this.operation.cancel();
  }
  onStop() {
    this.fields.clear();
    this.getState().set({ pending: false, errors: [], notice: "" });
  }
  onDestroy() {
    this.fields.destroy();
  }
}
export class AuthApplication extends FormApplication {
  mode: "login" | "register" = "login";
  onStart(_app: unknown, { mode }: { mode: "login" | "register" }) {
    this.mode = mode;
    this.fields.reset();
    this.showView(
      new FormView({ mode, model: this.fields, state: this.getState() }),
    );
  }
  submit() {
    const fields = this.fields.toObject() as Fields;
    this.save(
      (signal) =>
        this.context.session.api.authenticate(this.mode, fields, signal),
      (user) => {
        this.context.session.accept(user);
        this.context.navigate("/");
      },
    );
  }
}
export class SettingsApplication extends FormApplication {
  onStart() {
    const user = this.context.session.user()!;
    this.fields.reset({
      username: user.username,
      email: user.email,
      bio: user.bio || "",
      image: user.image || "",
      password: "",
    });
    this.showView(
      new FormView({
        mode: "settings",
        model: this.fields,
        state: this.getState(),
      }),
    );
  }
  submit() {
    const fields = this.fields.toObject() as Fields;
    if (!fields.password) delete fields.password;
    this.save(
      (signal) => this.context.session.api.updateUser(fields, signal),
      (user) => {
        this.context.session.accept(user);
        this.context.navigate(profilePath(user.username));
      },
    );
  }
}
export class EditorApplication extends FormApplication {
  slug?: string;
  tags = new Model<{ tags: string[] }>({ tags: [] });
  async prepareStart(
    { slug }: { slug?: string },
    { signal }: LifecycleContext,
  ) {
    if (!slug) return null;
    const article = await this.context.session.api.article(slug, signal);
    if (article.author.username !== this.context.session.user()?.username)
      throw new ApiError(403, ["Only the author can edit this article."]);
    return article;
  }
  onStart(_app: unknown, { slug }: { slug?: string }, article: Article | null) {
    this.slug = slug;
    this.fields.reset({
      title: article?.title || "",
      description: article?.description || "",
      body: article?.body || "",
    });
    this.tags.set("tags", article?.tagList || []);
    this.showView(
      new FormView({
        mode: "editor",
        editing: !!slug,
        model: this.fields,
        state: this.getState(),
        tags: this.tags,
      }),
    );
  }
  submit() {
    const fields = this.fields.toObject() as Fields;
    const draft = {
      title: fields.title || "",
      description: fields.description || "",
      body: fields.body || "",
      tagList: this.tags.get("tags") || [],
    };
    this.save(
      (signal) =>
        this.context.session.api.saveArticle(this.slug, draft, signal),
      (article) => {
        this.slug = article.slug;
        const view = this.getView() as InstanceType<typeof FormView>;
        view.options.editing = true;
        view.render();
        if (
          JSON.stringify(fields) === JSON.stringify(this.fields.toObject()) &&
          JSON.stringify(draft.tagList) ===
            JSON.stringify(this.tags.get("tags"))
        )
          this.context.navigate(articlePath(article.slug));
        else
          this.getState().set(
            "notice",
            "Article saved. Your newer changes remain here; publish again to save them.",
          );
      },
    );
  }
  onDestroy() {
    super.onDestroy();
    this.tags.destroy();
  }
}
