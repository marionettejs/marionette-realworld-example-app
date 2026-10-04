import { View, type DelegatedEvent } from "marionette";
import type { Model } from "@mnjs/data";
import { html } from "lit-html";
import { input, textarea } from "../../shared/form-fields";
import { errorsTemplate } from "../../shared/presentation";
import type { FormStatus } from "../../shared/types";
export type SettingsFields = {
  username: string;
  email: string;
  password: string;
  image: string;
  bio: string;
};
export const SettingsView = View.extend({
  className: "settings-page",
  initialize(_options: {
    model: Model<SettingsFields>;
    state: Model<FormStatus>;
  }) {},
  modelEvents: { change: "render" },
  stateEvents: { change: "render" },
  templateContext() {
    return {
      fields: this.options.model.toObject(),
      ...this.options.state.toObject(),
    };
  },
  template: ({
    fields,
    pending,
    errors,
  }: FormStatus & { fields: Partial<SettingsFields> }) =>
    html`<div class="container page">
      <div class="row">
        <div class="col-md-6 offset-md-3 col-xs-12">
          <h1 class="text-xs-center" tabindex="-1">Your Settings</h1>
          ${errorsTemplate(errors)}
          <p role="status">${pending ? "Saving…" : ""}</p>
          <form>
            ${input(
              "image",
              "URL of profile picture",
              fields.image,
              "url",
              false,
            )}
            ${input(
              "username",
              "Your Name",
              fields.username,
              "text",
              true,
              "username",
            )}${textarea("bio", "Short bio about you", fields.bio)}
            ${input(
              "email",
              "Email",
              fields.email,
              "email",
              true,
              "email",
            )}${input(
              "password",
              "New Password",
              fields.password,
              "password",
              false,
              "new-password",
            )}
            <button
              class="btn btn-lg btn-primary pull-xs-right"
              type="submit"
              ?disabled=${pending}
            >
              Update Settings
            </button>
          </form>
          <hr />
          <button class="logout btn btn-outline-danger" type="button">
            Or click here to logout.
          </button>
        </div>
      </div>
    </div>`,
  events: { "input [name]": "edit", "submit form": "submit" },
  triggers: { "click .logout": "logout" },
  edit(event: DelegatedEvent) {
    const field = event.delegateTarget;
    if (
      (field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement) &&
      (field.name === "username" ||
        field.name === "email" ||
        field.name === "password" ||
        field.name === "image" ||
        field.name === "bio")
    )
      this.options.model.set(field.name, field.value);
  },
  submit(event: Event) {
    event.preventDefault();
    this.trigger("submit");
  },
});
