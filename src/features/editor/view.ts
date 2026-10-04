import { View, type DelegatedEvent } from "marionette";
import type { Model } from "@mnjs/data";
import { html } from "lit-html";
import { input, textarea } from "../../shared/form-fields";
import { errorsTemplate } from "../../shared/presentation";
import type { FormStatus } from "../../shared/types";
import type { Draft } from "../../shared/types";
export type EditorFields = Draft & { slug?: string };
export const EditorView = View.extend({
  className: "editor-page",
  initialize(_options: {
    model: Model<EditorFields>;
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
    notice,
  }: FormStatus & { fields: Partial<EditorFields> }) =>
    html`<div class="container page">
      <div class="row">
        <div class="col-md-10 offset-md-1 col-xs-12">
          <h1 class="sr-only" tabindex="-1">
            ${fields.slug ? "Edit Article" : "New Article"}
          </h1>
          ${errorsTemplate(errors)}
          <p role="status" class=${notice || pending ? "" : "sr-only"}>
            ${notice || (pending ? "Saving…" : "")}
          </p>
          <form>
            ${input("title", "Article Title", fields.title)}${input(
              "description",
              "What's this article about?",
              fields.description,
            )}${textarea(
              "body",
              "Write your article (in markdown)",
              fields.body,
              true,
            )}
            <fieldset class="form-group">
              <label class="sr-only" for="tag-input">Enter tags</label
              ><input
                id="tag-input"
                class="form-control tag-input"
                placeholder="Enter tags"
                aria-describedby="tag-help"
              /><small id="tag-help" class="sr-only"
                >Press Enter to add a tag.</small
              >
              <div class="tag-list">
                ${(fields.tagList ?? []).map(
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
            </fieldset>
            <button
              class="btn btn-lg btn-primary pull-xs-right"
              type="submit"
              ?disabled=${pending}
            >
              Publish Article
            </button>
          </form>
        </div>
      </div>
    </div>`,
  events: {
    "input [name]": "edit",
    "keydown .tag-input": "addTag",
    "click .remove-tag": "removeTag",
    "submit form": "submit",
  },
  edit(event: DelegatedEvent) {
    const field = event.delegateTarget;
    if (
      (field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement) &&
      (field.name === "title" ||
        field.name === "description" ||
        field.name === "body")
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
    const tags = this.options.model.get("tagList") ?? [];
    if (tag && !tags.includes(tag))
      this.options.model.set("tagList", [...tags, tag]);
    field.value = "";
  },
  removeTag(event: DelegatedEvent) {
    const tag = (event.delegateTarget as HTMLElement).dataset.tag;
    this.options.model.set(
      "tagList",
      (this.options.model.get("tagList") ?? []).filter(
        (value) => value !== tag,
      ),
    );
  },
  submit(event: Event) {
    event.preventDefault();
    this.trigger("submit");
  },
});
