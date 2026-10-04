import { FormApplication } from "../../shared/form-application";
import { profilePath } from "../../shared/presentation";
import { SettingsView, type SettingsFields } from "./view";
export class SettingsApplication extends FormApplication<SettingsFields> {
  get viewEvents() {
    return {
      ...super.viewEvents,
      logout: () => this.context.session.clear("/"),
    };
  }
  onStart() {
    const user = this.context.session.user()!;
    this.fields.reset({
      username: user.username,
      email: user.email,
      bio: user.bio || "",
      image: user.image || "",
      password: "",
    });
    this.showView(
      new SettingsView({ model: this.fields, state: this.getState() }),
    );
  }
  submit() {
    const fields = this.fields.toObject();
    if (!fields.password) delete fields.password;
    this.save(
      (signal) => this.context.session.api.updateUser(fields, signal),
      (user) => {
        this.context.session.accept(user);
        this.context.navigate(profilePath(user.username));
      },
    );
  }
}
