import { View } from "marionette";
import { html } from "lit-html";
import type { Profile, Status } from "../../shared/types";
import { avatar, errorsTemplate, profilePath } from "../../shared/presentation";
export const ProfileLayout = View.extend({
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
export const ProfileHeader = View.extend({
  modelEvents: { change: "render" },
  template: (p: Profile & Status & { self: boolean }) =>
    html`<div class="user-info">
      <div class="container">
        <div class="row">
          <div class="col-xs-12 col-md-10 offset-md-1">
            <img src=${avatar(p.image)} class="user-img" alt="" />
            <h4 tabindex="-1">${p.username}</h4>
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
export const ProfileTabs = View.extend({
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
