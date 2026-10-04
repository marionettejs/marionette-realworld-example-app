import { Application, type LifecycleContext } from "marionette";
import { Model } from "@mnjs/data";
import { FeedApplication } from "../feed/application";
import type { Context } from "../../app/session";
import type { FeedQuery } from "../../shared/types";
import { HomeLayout, HomeTabs, TagsView } from "./views";
export class HomeApplication extends Application {
  feed: FeedApplication;
  tabs = new Model<FeedQuery & { authenticated: boolean }>({
    page: 1,
    authenticated: false,
  });
  constructor(readonly context: Context) {
    super();
    this.feed = this.addChildApp("feed", new FeedApplication(context));
  }
  prepareStart(_options: unknown, { signal }: LifecycleContext) {
    return this.context.session.api.tags(signal);
  }
  onStart(_app: unknown, { query }: { query: FeedQuery }, tags: string[]) {
    let layout = this.getView() as InstanceType<typeof HomeLayout> | undefined;
    if (!layout) {
      layout = this.setView(new HomeLayout());
      layout.showChildView("tabs", new HomeTabs({ model: this.tabs }));
    }
    layout.showChildView("tags", new TagsView({ model: { tags } }));
    this.showView();
    // Feed readiness is independently retryable; the parent does not await it.
    void this.feed.open(layout.getRegion("feed")!, query);
    this.tabs.reset({ ...query, authenticated: !!this.context.session.user() });
  }
  setQuery(query: FeedQuery) {
    this.tabs.reset({ ...query, authenticated: !!this.context.session.user() });
    void this.feed.load(query);
  }
  onDestroy() {
    this.tabs.destroy();
  }
}
