import { View, type DelegatedEvent } from "marionette";
import { html } from "lit-html";
import type { User } from "../shared/types";
import { avatar, profilePath } from "../shared/presentation";
import type { AuthState } from "./session";
export const ShellView = View.extend({
  template: () =>
    html`<a href="#main" class="skip-link">Skip to content</a>
      <header></header>
      <div class="session-status"></div>
      <main id="main" tabindex="-1"></main>
      <footer>
        <div class="container">
          <a href="/" class="logo-font">conduit</a
          ><span class="attribution"
            >An interactive learning project. Code &amp; design licensed under
            MIT.</span
          >
        </div>
      </footer>`,
  regions: { header: "header", status: ".session-status", content: "main" },
  events: { "click a": "navigate" },
  navigate(event: DelegatedEvent) {
    const link = event.delegateTarget;
    const mouse = event as MouseEvent;
    if (
      !(link instanceof HTMLAnchorElement) ||
      mouse.button !== 0 ||
      mouse.metaKey ||
      mouse.ctrlKey ||
      mouse.shiftKey ||
      mouse.altKey ||
      link.target ||
      link.hasAttribute("download")
    )
      return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || url.hash) return;
    event.preventDefault();
    this.trigger("navigate", url.pathname + url.search);
  },
});
export const HeaderView = View.extend({
  modelEvents: { change: "render" },
  template: ({ user, path }: { user: User | null; path: string }) => {
    const nav = (href: string, label: string) =>
      html`<li class="nav-item">
        <a class="nav-link ${path === href ? "active" : ""}" href=${href}
          >${label}</a
        >
      </li>`;
    return html`<nav class="navbar navbar-light" aria-label="Main navigation">
      <div class="container">
        <a class="navbar-brand" href="/">conduit</a>
        <ul class="nav navbar-nav pull-xs-right">
          ${nav("/", "Home")}${user
            ? html`${nav("/editor", "New Article")}${nav(
                  "/settings",
                  "Settings",
                )}
                <li class="nav-item">
                  <a
                    class="nav-link ${path === profilePath(user.username)
                      ? "active"
                      : ""}"
                    href=${profilePath(user.username)}
                    ><img class="user-pic" src=${avatar(user.image)} alt="" />
                    ${user.username}</a
                  >
                </li>`
            : html`${nav("/login", "Sign in")}${nav("/register", "Sign up")}`}
        </ul>
      </div>
    </nav>`;
  },
});
export const SessionStatusView = View.extend({
  modelEvents: { change: "render" },
  template: ({ status }: { status: AuthState }) =>
    html`${status === "unavailable"
      ? html`<div class="container" role="alert">
          Your session could not be checked.
          <button class="retry btn btn-outline-primary">Retry session</button>
          <button class="logout btn btn-outline-danger">Sign out</button>
        </div>`
      : status === "loading"
        ? html`<p class="container" role="status">Checking session…</p>`
        : ""}`,
  triggers: { "click .retry": "retry", "click .logout": "logout" },
});
