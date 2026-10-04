import { View, type DelegatedEvent } from "marionette";
import type { Model } from "@mnjs/data";
import { html } from "lit-html";
import { input } from "../../shared/form-fields";
import { errorsTemplate } from "../../shared/presentation";
import type { FormStatus } from "../../shared/types";
export type AuthFields = { username: string; email: string; password: string };
export type AuthMode = "login" | "register";
export const AuthView = View.extend({
  className: "auth-page",
  initialize(_options: {
    mode: AuthMode;
    model: Model<AuthFields>;
    state: Model<FormStatus>;
  }) {},
  modelEvents: { change: "render" },
  stateEvents: { change: "render" },
  templateContext() {
    return {
      fields: this.options.model.toObject(),
      mode: this.options.mode,
      ...this.options.state.toObject(),
    };
  },
  template: ({
    fields,
    mode,
    pending,
    errors,
  }: FormStatus & { fields: Partial<AuthFields>; mode: AuthMode }) => {
    const login = mode === "login";
    const heading = login ? "Sign in" : "Sign up";
    return html`<div class="container page">
      <div class="row">
        <div class="col-md-6 offset-md-3 col-xs-12">
          <h1 class="text-xs-center" tabindex="-1">${heading}</h1>
          <p class="text-xs-center">
            <a href=${login ? "/register" : "/login"}
              >${login ? "Need an account?" : "Have an account?"}</a
            >
          </p>
          ${errorsTemplate(errors)}
          <p role="status">${pending ? "Saving…" : ""}</p>
          <form>
            ${!login
              ? input(
                  "username",
                  "Username",
                  fields.username,
                  "text",
                  true,
                  "username",
                )
              : ""}
            ${input("email", "Email", fields.email, "email", true, "email")}
            ${input(
              "password",
              "Password",
              fields.password,
              "password",
              true,
              login ? "current-password" : "new-password",
            )}
            <button
              class="btn btn-lg btn-primary pull-xs-right"
              type="submit"
              ?disabled=${pending}
            >
              ${heading}
            </button>
          </form>
        </div>
      </div>
    </div>`;
  },
  events: { "input [name]": "edit", "submit form": "submit" },
  edit(event: DelegatedEvent) {
    const field = event.delegateTarget;
    if (
      field instanceof HTMLInputElement &&
      (field.name === "username" ||
        field.name === "email" ||
        field.name === "password")
    )
      this.options.model.set(field.name, field.value);
  },
  submit(event: Event) {
    event.preventDefault();
    this.trigger("submit");
  },
});
