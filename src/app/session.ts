import { Application, type LifecycleContext } from "marionette";
import { Model } from "@mnjs/data";
import { Api, ApiError } from "../shared/api";
import type { User } from "../shared/types";
export type AuthState =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";
export type SessionState = { user: User | null; status: AuthState };
export class SessionApplication extends Application {
  createState() {
    return new Model<SessionState>({ user: null, status: "loading" });
  }
  declare getState: () => Model<SessionState>;
  private credentialToken = this.token();
  private verifiedToken: string | null = null;
  private credentials = new AbortController();
  api = new Api(
    (write) => {
      this.syncCredentials();
      if (
        write &&
        (this.getState().get("status") !== "authenticated" ||
          this.verifiedToken !== this.token())
      )
        throw new ApiError(401, ["Verify your session before making changes."]);
      return { token: this.token(), signal: this.credentials.signal };
    },
    () => this.clear(),
  );
  token() {
    return localStorage.getItem("jwtToken");
  }
  user() {
    return this.getState().get("user") ?? null;
  }
  private syncCredentials() {
    if (this.credentialToken === this.token()) return;
    this.renewAuthority();
    this.getState().set("status", "loading");
  }
  private renewAuthority() {
    this.credentials.abort(
      new DOMException(
        "Session changed. Please retry after verification.",
        "AbortError",
      ),
    );
    this.credentials = new AbortController();
    this.credentialToken = this.token();
  }
  // Captured by completion owners too: an API substitute may ignore abort.
  authority() {
    this.syncCredentials();
    const signal = this.credentials.signal;
    const token = this.token();
    return () => !signal.aborted && token === this.token();
  }
  onBeforeStart() {
    this.syncCredentials();
    this.getState().set("status", "loading");
  }
  async prepareStart(
    _options: unknown,
    { signal }: LifecycleContext,
  ): Promise<SessionState | null> {
    if (!this.token()) return { user: null, status: "unauthenticated" };
    const current = this.authority();
    try {
      const user = await this.api.current(signal);
      signal.throwIfAborted();
      return current() ? { user, status: "authenticated" } : null;
    } catch (error) {
      signal.throwIfAborted();
      if (!current()) return null;
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        this.clear();
        return null;
      }
      return {
        user: this.verifiedToken === this.token() ? this.user() : null,
        status: "unavailable",
      };
    }
  }
  onStart(_app: unknown, _options: unknown, state: SessionState | null) {
    if (!state) return;
    if (state.status === "authenticated") this.verifiedToken = this.token();
    this.getState().set(state);
  }
  accept(user: User) {
    localStorage.setItem("jwtToken", user.token);
    this.renewAuthority();
    this.verifiedToken = user.token;
    this.getState().set({ user, status: "authenticated" });
  }
  clear(destination = "/login") {
    localStorage.removeItem("jwtToken");
    this.renewAuthority();
    this.verifiedToken = null;
    this.getState().set({ user: null, status: "unauthenticated" });
    this.trigger("signed:out", destination);
  }
  onBeforeStop() {
    this.renewAuthority();
  }
}
export interface Context {
  session: SessionApplication;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}
export function requireUser(context: Context): boolean {
  if (context.session.user()) return true;
  context.navigate("/login");
  return false;
}
