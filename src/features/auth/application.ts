import { FormApplication } from "../../shared/form-application";
import { AuthView, type AuthFields, type AuthMode } from "./view";
export class AuthApplication extends FormApplication<AuthFields> {
  mode: AuthMode = "login";
  onStart(_app: unknown, { mode }: { mode: AuthMode }) {
    this.mode = mode;
    this.fields.reset();
    this.showView(
      new AuthView({ mode, model: this.fields, state: this.getState() }),
    );
  }
  submit() {
    const fields = this.fields.toObject();
    this.save(
      (signal) =>
        this.context.session.api.authenticate(this.mode, fields, signal),
      (user) => {
        this.context.session.accept(user);
        this.context.navigate("/");
      },
    );
  }
}
