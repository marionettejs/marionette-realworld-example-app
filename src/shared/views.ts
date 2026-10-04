import { View } from "marionette";
import { html } from "lit-html";
export const LoadingView = View.extend({
  template: () =>
    html`<div class="container page" role="status">Loading…</div>`,
});
export const ErrorView = View.extend({
  template: ({ message }: { message: string }) =>
    html`<div class="container page">
      <h1 tabindex="-1">Unable to load this page</h1>
      <p role="alert">${message}</p>
      <button class="retry btn btn-primary">Retry</button>
    </div>`,
  triggers: { "click .retry": "retry" },
});
export const NotFoundView = View.extend({
  template: () =>
    html`<div class="container page">
      <h1 tabindex="-1">Page not found</h1>
      <a href="/">Back to the feed</a>
    </div>`,
});
