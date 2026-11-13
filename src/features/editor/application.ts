import { RouteApplication, type ActiveMatch } from "@mnjs/router";
import type { Context } from "../../app/session";
import { segment } from "../../shared/api";
import { EditorDraftApplication } from "./draft-application";
import { editorRoutes } from "./routes";

export class EditorApplication extends RouteApplication {
  draft: EditorDraftApplication;
  get routes() {
    return editorRoutes;
  }
  routeOptions() {
    return {};
  }
  constructor(readonly context: Context) {
    super();
    this.draft = this.addChildApp("draft", new EditorDraftApplication(context));
    this.listenTo(this.draft, {
      "draft:saved": (slug: string) =>
        this.context.navigate(`/editor/${segment(slug)}`, { replace: true }),
      "before:start": () => {
        if (!this.draft.isRunning()) this.trigger("page:loading");
      },
    });
  }
  async showEditor(match: ActiveMatch) {
    const slug = match.params.slug;
    if (
      this.getCurrent() === this.draft &&
      this.draft.isRunning() &&
      this.draft.fields.get("slug") === slug
    )
      return;
    await this.switchTo("draft", {
      key: slug,
      restart: this.getCurrent() === this.draft,
      signal: match.signal,
      options: { slug, region: this.getRegion() },
    });
  }
}
