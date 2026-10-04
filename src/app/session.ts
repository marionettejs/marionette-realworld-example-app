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
  getState() {
    return super.getState() as Model<SessionState>;
  }
  api = new Api(
    () => this.token(),
    () => this.clear(),
  );
  token() {
    return localStorage.getItem("jwtToken");
  }
  user() {
    return this.getState().get("user") ?? null;
  }
  async prepareStart(
    _options: unknown,
    { signal }: LifecycleContext,
  ): Promise<SessionState> {
    if (!this.token()) return { user: null, status: "unauthenticated" };
    try {
      return { user: await this.api.current(signal), status: "authenticated" };
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof ApiError && error.status === 401)
        return { user: null, status: "unauthenticated" };
      return { user: null, status: "unavailable" };
    }
  }
  onStart(_app: unknown, _options: unknown, state: SessionState) {
    this.getState().set(state);
  }
  accept(user: User) {
    localStorage.setItem("jwtToken", user.token);
    this.getState().set({ user, status: "authenticated" });
  }
  clear() {
    localStorage.removeItem("jwtToken");
    this.getState().set({ user: null, status: "unauthenticated" });
  }
}
export interface Context {
  session: SessionApplication;
  navigate: (path: string) => void;
}
export function requireUser(context: Context): boolean {
  if (context.session.user()) return true;
  context.navigate("/login");
  return false;
}
