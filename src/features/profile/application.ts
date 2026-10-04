import { Application, type LifecycleContext } from "marionette";
import { Model } from "@mnjs/data";
import { FeedApplication } from "../feed/application";
import { requireUser, type Context } from "../../app/session";
import type { FeedQuery, Profile } from "../../shared/types";
import { errorMessages } from "../../shared/api";
import { Operation } from "../../shared/operation";
import { ProfileLayout, ProfileHeader, ProfileTabs } from "./views";
type ProfileStart = { username: string; query: FeedQuery };
export class ProfileApplication extends Application {
  feed: FeedApplication;
  profile = new Model<
    Profile & { self: boolean; pending: boolean; errors: string[] }
  >();
  tabs = new Model<{ username: string; favorites: boolean }>();
  operation = new Operation();
  constructor(readonly context: Context) {
    super();
    this.feed = this.addChildApp("feed", new FeedApplication(context));
  }
  get viewEvents() {
    return { follow: () => this.follow() };
  }
  prepareStart({ username }: ProfileStart, { signal }: LifecycleContext) {
    return this.context.session.api.profile(username, signal);
  }
  onStart(_app: unknown, { query }: ProfileStart, profile: Profile) {
    this.profile.reset({
      ...profile,
      self: profile.username === this.context.session.user()?.username,
      pending: false,
      errors: [],
    });
    this.tabs.reset({
      username: profile.username,
      favorites: !!query.favorited,
    });
    let layout = this.getView() as
      | InstanceType<typeof ProfileLayout>
      | undefined;
    if (!layout) {
      layout = this.setView(new ProfileLayout());
      layout.showChildView(
        "header",
        new ProfileHeader({ model: this.profile }),
      );
      layout.showChildView("tabs", new ProfileTabs({ model: this.tabs }));
    }
    this.showView();
    void this.feed.open(layout.getRegion("feed")!, query);
  }
  setQuery(query: FeedQuery) {
    this.tabs.set("favorites", !!query.favorited);
    void this.feed.load(query);
  }
  follow() {
    if (!requireUser(this.context) || this.profile.get("pending")) return;
    this.profile.set({ pending: true, errors: [] });
    void this.operation.run(
      (signal) =>
        this.context.session.api.follow(
          this.profile.toObject() as Profile,
          signal,
        ),
      (result) => this.profile.set({ ...result, pending: false }),
      (error) =>
        this.profile.set({ pending: false, errors: errorMessages(error) }),
    );
  }
  onBeforeStop() {
    this.operation.cancel();
  }
  onDestroy() {
    this.profile.destroy();
    this.tabs.destroy();
  }
}
