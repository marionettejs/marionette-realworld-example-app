import "./setup";
import "./styles.css";
import { ConduitApplication } from "./app/application";
const app = new ConduitApplication();
window.__conduit_debug__ = {
  getToken: () => app.session.token(),
  getAuthState: () => app.session.getState().get("status") || "loading",
  getCurrentUser: () => app.session.user(),
};
// Lifecycle test access is only present in Vite development, never the production bundle.
if (import.meta.env.DEV) window.__conduit_app__ = app;
void app.start().catch(() => {
  const mount = document.getElementById("app");
  if (mount) mount.textContent = "Unable to start Conduit. Please reload.";
});
if (import.meta.hot) import.meta.hot.dispose(() => app.destroy());
declare global {
  interface Window {
    __conduit_debug__: {
      getToken(): string | null;
      getAuthState(): string;
      getCurrentUser(): import("./shared/types").User | null;
    };
    __conduit_app__?: ConduitApplication;
  }
}
