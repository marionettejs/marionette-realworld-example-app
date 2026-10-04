import { Application, View, type LifecycleContext } from "marionette";
import { Model } from "@mnjs/data";
import { html } from "lit-html";
import { FeedApplication } from "./feed";
import { requireUser, type Context } from "../app/session";
import type { FeedQuery, Profile } from "../shared/types";
import { avatar, errorsTemplate, profilePath } from "../shared/presentation";
import { errorMessages } from "../shared/api";
import { Operation } from "../shared/operation";
const ProfileLayout = View.extend({
  className: "profile-page",
  template: () =>
    html`<div class="profile-header"></div>
      <div class="container">
        <div class="row">
          <div class="col-xs-12 col-md-10 offset-md-1">
            <div class="tabs"></div>
            <div class="feed"></div>
          </div>
        </div>
      </div>`,
  regions: { header: ".profile-header", tabs: ".tabs", feed: ".feed" },
  childViewTriggers: { follow: "follow" },
});
const ProfileHeader = View.extend({
  modelEvents: { change: "render" },
  template: (
    p: Profile & { self: boolean; pending: boolean; errors: string[] },
  ) =>
    html`<div class="user-info">
      <div class="container">
        <div class="row">
          <div class="col-xs-12 col-md-10 offset-md-1">
            <img src=${avatar(p.image)} class="user-img" alt="" />
            <h1 tabindex="-1">${p.username}</h1>
            <p>${p.bio}</p>
            ${p.self
              ? html`<a
                  class="btn btn-sm btn-outline-secondary action-btn"
                  href="/settings"
                  ><i class="ion-gear-a" aria-hidden="true"></i> Edit Profile
                  Settings</a
                >`
              : html`<button
                  class="follow btn btn-sm btn-outline-secondary action-btn"
                  ?disabled=${p.pending}
                  aria-pressed=${p.following}
                >
                  <i class="ion-plus-round" aria-hidden="true"></i>
                  ${p.following ? "Unfollow" : "Follow"} ${p.username}
                </button>`}${errorsTemplate(p.errors)}
          </div>
        </div>
      </div>
    </div>`,
  triggers: { "click .follow": "follow" },
});
const ProfileTabs = View.extend({
  modelEvents: { change: "render" },
  template: ({
    username,
    favorites,
  }: {
    username: string;
    favorites: boolean;
  }) =>
    html`<div class="articles-toggle">
      <ul class="nav nav-pills outline-active">
        <li class="nav-item">
          <a
            class="nav-link ${!favorites ? "active" : ""}"
            href=${profilePath(username)}
            >My Articles</a
          >
        </li>
        <li class="nav-item">
          <a
            class="nav-link ${favorites ? "active" : ""}"
            href=${`${profilePath(username)}/favorites`}
            >Favorited Articles</a
          >
        </li>
      </ul>
    </div>`,
});
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
    const layout = this.setView(new ProfileLayout());
    layout.showChildView("header", new ProfileHeader({ model: this.profile }));
    layout.showChildView("tabs", new ProfileTabs({ model: this.tabs }));
    this.showView();
    void this.feed.open(layout.getRegion("feed")!, query);
  }
  setQuery(query: FeedQuery) {
    this.tabs.set("favorites", !!query.favorited);
    void this.feed.load(query);
  }
  follow() {
    if (!requireUser(this.context)) return;
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
