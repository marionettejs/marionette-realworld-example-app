import type { LifecycleContext } from "marionette";
import { FormApplication } from "../../shared/form-application";
import { ApiError } from "../../shared/api";
import { articlePath } from "../../shared/presentation";
import type { Article, Draft } from "../../shared/types";
import { EditorView, type EditorFields } from "./view";
export class EditorApplication extends FormApplication<EditorFields> {
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
  onStart(_app: unknown, _options: unknown, article: Article | null) {
    this.fields.reset({
      title: article?.title || "",
      description: article?.description || "",
      body: article?.body || "",
      tagList: article?.tagList || [],
      slug: article?.slug,
    });
    this.showView(
      new EditorView({ model: this.fields, state: this.getState() }),
    );
  }
  draft(): Draft {
    return {
      title: this.fields.get("title") || "",
      description: this.fields.get("description") || "",
      body: this.fields.get("body") || "",
      tagList: [...(this.fields.get("tagList") || [])],
    };
  }
  submit() {
    const draft = this.draft();
    const slug = this.fields.get("slug");
    this.save(
      (signal) => this.context.session.api.saveArticle(slug, draft, signal),
      (article) => {
        this.fields.set("slug", article.slug);
        const current = this.draft();
        const unchanged =
          draft.title === current.title &&
          draft.description === current.description &&
          draft.body === current.body &&
          draft.tagList.length === current.tagList.length &&
          draft.tagList.every((tag, index) => tag === current.tagList[index]);
        if (unchanged) this.context.navigate(articlePath(article.slug));
        else {
          this.trigger("draft:saved", article.slug);
          this.getState().set(
            "notice",
            "Article saved. Your newer changes remain here; publish again to save them.",
          );
        }
      },
    );
  }
}
