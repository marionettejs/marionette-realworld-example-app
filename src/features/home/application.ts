import { Application, type LifecycleContext } from "marionette";
import { Model } from "@mnjs/data";
import { FeedApplication } from "../feed/application";
import type { Context } from "../../app/session";
import type { FeedQuery } from "../../shared/types";
import { HomeLayout, HomeTabs, TagsView } from "./views";
export class HomeApplication extends Application {
  feed: FeedApplication;
  tabs = new Model<FeedQuery & { authenticated: boolean }>();
  constructor(readonly context: Context) {
    super();
    this.feed = this.addChildApp("feed", new FeedApplication(context));
  }
  prepareStart({ query }: { query: FeedQuery }, { signal }: LifecycleContext) {
    let layout = this.getView() as InstanceType<typeof HomeLayout> | undefined;
    if (!layout) {
      // Resolve child Regions off-screen; tags still govern page activation.
      layout = this.setView(new HomeLayout());
      layout.render();
    }
    void this.feed.load(query, layout.getRegion("feed")!);
    return this.context.session.api.tags(signal);
  }
  onStart(_app: unknown, { query }: { query: FeedQuery }, tags: string[]) {
    const layout = this.getView() as InstanceType<typeof HomeLayout>;
    this.tabs.reset({ ...query, authenticated: !!this.context.session.user() });
    if (!layout.getChildView("tabs"))
      layout.showChildView("tabs", new HomeTabs({ model: this.tabs }));
    layout.showChildView("tags", new TagsView({ model: { tags } }));
    this.showView();
  }
  setQuery(query: FeedQuery) {
    this.tabs.reset({ ...query, authenticated: !!this.context.session.user() });
    void this.feed.load(query);
  }
  onDestroy() {
    this.tabs.destroy();
  }
}
