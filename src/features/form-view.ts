import { View, type DelegatedEvent } from "marionette";
import { Model } from "@mnjs/data";
import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
import { errorsTemplate } from "../shared/presentation";
import type { Status } from "../shared/types";
export type FormMode = "login" | "register" | "editor" | "settings";
export type Fields = Record<string, string>;
export type FormOptions = {
  mode: FormMode;
  model: Model<Fields>;
  state: Model<Status & { notice?: string }>;
  tags?: Model<{ tags: string[] }>;
  editing?: boolean;
};
function input(
  name: string,
  label: string,
  fields: Partial<Fields>,
  type = "text",
  required = true,
) {
  return html`<fieldset class="form-group">
    <label class="sr-only" for=${name}>${label}</label
    ><input
      id=${name}
      name=${name}
      class="form-control form-control-lg"
      type=${type}
      placeholder=${label}
      .value=${live(fields[name] || "")}
      ?required=${required}
      autocomplete=${name === "password"
        ? "current-password"
        : name === "email"
          ? "email"
          : "off"}
    />
  </fieldset>`;
}
function textarea(name: string, label: string, fields: Partial<Fields>) {
  return html`<fieldset class="form-group">
    <label class="sr-only" for=${name}>${label}</label
    ><textarea
      id=${name}
      name=${name}
      class="form-control"
      rows="8"
      placeholder=${label}
      .value=${live(fields[name] || "")}
      ?required=${name === "body"}
    ></textarea>
  </fieldset>`;
}
export const FormView = View.extend({
  initialize(options: FormOptions) {
    if (options.tags)
      this.listenTo(options.tags, { change: () => this.render() });
  },
  className() {
    const mode = this.options.mode;
    return mode === "editor"
      ? "editor-page"
      : mode === "settings"
        ? "settings-page"
        : "auth-page";
  },
  modelEvents: { change: "render" },
  stateEvents: { change: "render" },
  templateContext() {
    return {
      fields: this.options.model.toObject(),
      ...this.options.state.toObject(),
      mode: this.options.mode,
      tags: this.options.tags?.get("tags") ?? [],
      editing: this.options.editing,
    };
  },
  template: ({
    fields,
    mode,
    pending,
    errors,
    tags,
    editing,
    notice,
  }: FieldsTemplate) => {
    const heading =
      mode === "login"
        ? "Sign in"
        : mode === "register"
          ? "Sign up"
          : mode === "settings"
            ? "Your Settings"
            : editing
              ? "Edit Article"
              : "New Article";
    const submit =
      mode === "editor"
        ? "Publish Article"
        : mode === "settings"
          ? "Update Settings"
          : heading;
    return html`<div class="container page">
      <div class="row">
        <div
          class=${mode === "editor"
            ? "col-md-10 offset-md-1 col-xs-12"
            : "col-md-6 offset-md-3 col-xs-12"}
        >
          <h1 class="text-xs-center" tabindex="-1">${heading}</h1>
          ${mode === "login" || mode === "register"
            ? html`<p class="text-xs-center">
                <a href=${mode === "login" ? "/register" : "/login"}
                  >${mode === "login"
                    ? "Need an account?"
                    : "Have an account?"}</a
                >
              </p>`
            : ""}${errorsTemplate(errors)}
          <p role="status">${notice || (pending ? "Saving…" : "")}</p>
          <form>
            ${mode === "settings"
              ? input("image", "URL of profile picture", fields, "url", false)
              : ""}
            ${mode === "register" || mode === "settings"
              ? input(
                  "username",
                  mode === "settings" ? "Your Name" : "Username",
                  fields,
                )
              : ""}
            ${mode === "settings"
              ? textarea("bio", "Short bio about you", fields)
              : ""}
            ${mode !== "editor"
              ? html`${input("email", "Email", fields, "email")}${input(
                  "password",
                  mode === "settings" ? "New Password" : "Password",
                  fields,
                  "password",
                  mode !== "settings",
                )}`
              : html`${input("title", "Article Title", fields)}${input(
                    "description",
                    "What's this article about?",
                    fields,
                  )}${textarea(
                    "body",
                    "Write your article (in markdown)",
                    fields,
                  )}
                  <fieldset class="form-group">
                    <label class="sr-only" for="tag-input">Enter tags</label>
                    <input
                      id="tag-input"
                      class="form-control tag-input"
                      placeholder="Enter tags"
                      aria-describedby="tag-help"
                    />
                    <small id="tag-help">Press Enter to add a tag.</small>
                    <div class="tag-list">
                      ${tags.map(
                        (tag) =>
                          html`<span class="tag-default tag-pill"
                            ><button
                              type="button"
                              class="remove-tag"
                              data-tag=${tag}
                              aria-label=${`Remove tag ${tag}`}
                            >
                              <i
                                class="ion-close-round"
                                aria-hidden="true"
                              ></i></button
                            >${tag}</span
                          >`,
                      )}
                    </div>
                  </fieldset>`}
            <button
              class="btn btn-lg btn-primary pull-xs-right"
              type="submit"
              ?disabled=${pending}
            >
              ${submit}
            </button>
          </form>
          ${mode === "settings"
            ? html`<hr />
                <button class="logout btn btn-outline-danger" type="button">
                  Or click here to logout.
                </button>`
            : ""}
        </div>
      </div>
    </div>`;
  },
  events: {
    "input [name]": "edit",
    "keydown .tag-input": "addTag",
    "click .remove-tag": "removeTag",
    "submit form": "submit",
  },
  triggers: { "click .logout": "logout" },
  edit(event: DelegatedEvent) {
    const field = event.delegateTarget;
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
    )
      this.options.model.set(field.name, field.value);
  },
  addTag(event: DelegatedEvent) {
    const field = event.delegateTarget;
    if (
      !(field instanceof HTMLInputElement) ||
      (event as KeyboardEvent).key !== "Enter"
    )
      return;
    event.preventDefault();
    const tag = field.value.trim();
    const tags = this.options.tags?.get("tags") ?? [];
    if (tag && !tags.includes(tag))
      this.options.tags?.set("tags", [...tags, tag]);
    field.value = "";
  },
  removeTag(event: DelegatedEvent) {
    const tag = (event.delegateTarget as HTMLElement).dataset.tag;
    this.options.tags?.set(
      "tags",
      (this.options.tags.get("tags") ?? []).filter((value) => value !== tag),
    );
  },
  submit(event: Event) {
    event.preventDefault();
    this.trigger("submit");
  },
});
interface FieldsTemplate extends Status {
  fields: Partial<Fields>;
  mode: FormMode;
  tags: string[];
  editing?: boolean;
  notice?: string;
}
