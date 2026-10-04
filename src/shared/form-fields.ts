import { html } from "lit-html";
import { live } from "lit-html/directives/live.js";
export function input(
  name: string,
  label: string,
  value = "",
  type = "text",
  required = true,
  autocomplete = "off",
) {
  return html`<fieldset class="form-group">
    <label class="sr-only" for=${name}>${label}</label
    ><input
      id=${name}
      name=${name}
      class="form-control form-control-lg"
      type=${type}
      placeholder=${label}
      .value=${live(value)}
      ?required=${required}
      autocomplete=${autocomplete}
    />
  </fieldset>`;
}
export function textarea(
  name: string,
  label: string,
  value = "",
  required = false,
) {
  return html`<fieldset class="form-group">
    <label class="sr-only" for=${name}>${label}</label
    ><textarea
      id=${name}
      name=${name}
      class="form-control"
      rows="8"
      placeholder=${label}
      .value=${live(value)}
      ?required=${required}
    ></textarea>
  </fieldset>`;
}
