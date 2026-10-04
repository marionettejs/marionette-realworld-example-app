import { Application } from "marionette";
import { Model } from "@mnjs/data";
import type { Context } from "../app/session";
import type { FormStatus } from "./types";
import { Operation } from "./operation";
import { errorMessages } from "./api";
// Shared save policy only. Each feature defines its fields, View, and completion.
export abstract class FormApplication<
  Fields extends Record<string, unknown>,
> extends Application {
  createState() {
    return new Model<FormStatus>({ pending: false, errors: [] });
  }
  getState() {
    return super.getState() as Model<FormStatus>;
  }
  fields = new Model<Fields>();
  operation = new Operation();
  constructor(readonly context: Context) {
    super();
  }
  get viewEvents() {
    return { submit: () => this.submit() };
  }
  abstract submit(): void;
  save<T>(
    work: (signal: AbortSignal) => Promise<T>,
    commit: (value: T) => void,
  ) {
    if (this.getState().get("pending")) return;
    const current = this.context.session.authority();
    this.getState().set({ pending: true, errors: [], notice: "" });
    void this.operation.run(
      work,
      (value) => {
        this.getState().set("pending", false);
        if (current()) commit(value);
        else
          this.getState().set("errors", [
            "Session changed. Verify your session before saving again.",
          ]);
      },
      (error) =>
        this.getState().set({ pending: false, errors: errorMessages(error) }),
    );
  }
  onBeforeStop() {
    this.operation.cancel();
  }
  onStop() {
    this.fields.clear();
    this.getState().set({ pending: false, errors: [], notice: "" });
  }
  onDestroy() {
    this.fields.destroy();
  }
}
