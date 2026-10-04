import {
  Application,
  type ViewInstance,
  type ApplicationInstance,
} from "marionette";
import { Model } from "@mnjs/data";
import { SessionApplication, type Context } from "./session";
import { ShellView, HeaderView, SessionStatusView } from "./shell";
import { parseRoute, type Route } from "./routes";
import { HomeApplication } from "../features/home";
import { ProfileApplication } from "../features/profile";
import { ArticleApplication } from "../features/article";
import {
  AuthApplication,
  EditorApplication,
  SettingsApplication,
} from "../features/forms";
import { ErrorView, LoadingView, NotFoundView } from "../shared/views";
import { errorMessages } from "../shared/api";
import type { User } from "../shared/types";
export class ConduitApplication extends Application {
  session: SessionApplication;
  header = new Model<{ user: User | null; path: string }>({
    user: null,
    path: "/",
  });
  current?: ApplicationInstance<object, unknown>;
  currentRoute?: Route;
  routeTask: Promise<void> = Promise.resolve();
  private routeUrl?: string;
  private onPopState = () => this.dispatch();
  private onStorage = (event: StorageEvent) => {
    if (event.key === "jwtToken" || event.key === null)
      void this.refreshSession();
  };
  constructor() {
    super({ region: { el: "#app" } });
    this.session = this.addChildApp("session", new SessionApplication());
    const context: Context = {
      session: this.session,
      navigate: (path) => this.navigate(path),
    };
    this.addChildApp("home", new HomeApplication(context));
    this.addChildApp("profile", new ProfileApplication(context));
    this.addChildApp("article", new ArticleApplication(context));
    this.addChildApp("auth", new AuthApplication(context));
    this.addChildApp("editor", new EditorApplication(context));
    this.addChildApp("settings", new SettingsApplication(context));
    this.listenTo(this.session.getState(), {
      change: () => this.sessionChanged(),
    });
  }
  get viewEvents() {
    return { navigate: (path: string) => this.navigate(path) };
  }
  async prepareStart() {
    await this.session.start();
  }
  onStart() {
    if (this.getView()) return;
    const shell = this.setView(new ShellView());
    shell.showChildView("header", new HeaderView({ model: this.header }));
    const status = shell.showChildView(
      "status",
      new SessionStatusView({ model: this.session.getState() }),
    );
    this.listenTo(status, {
      retry: () => {
        void this.refreshSession();
      },
      logout: () => {
        this.session.clear();
        this.navigate("/");
      },
    });
    this.showView();
    this.sessionChanged();
    window.addEventListener("popstate", this.onPopState);
    window.addEventListener("storage", this.onStorage);
    this.dispatch();
  }
  async refreshSession() {
    this.session.getState().set("status", "loading");
    await this.session.restart();
    if (!this.isRunning()) return;
    this.routeUrl = undefined;
    this.currentRoute = undefined;
    this.dispatch();
  }
  sessionChanged() {
    const previousUser = this.header.get("user");
    this.header.set({ user: this.session.user(), path: location.pathname });
    if (previousUser && !this.session.user() && this.isRunning()) {
      this.navigate("/login");
      return;
    }
    if (
      this.isRunning() &&
      !this.session.user() &&
      this.session.getState().get("status") === "unauthenticated" &&
      ["editor", "settings"].includes(this.currentRoute?.kind || "")
    )
      this.navigate("/login");
  }
  navigate(path: string) {
    if (path !== location.pathname + location.search)
      history.pushState({}, "", path);
    this.dispatch();
  }
  dispatch() {
    this.routeTask = this.showRoute();
  }
  async showRoute() {
    if (!this.isRunning()) return;
    const moveFocus = !!this.currentRoute;
    let route = parseRoute(new URL(location.href));
    if (
      (route.kind === "editor" ||
        route.kind === "settings" ||
        (route.kind === "home" && route.feed.following)) &&
      !this.session.user()
    ) {
      if (this.session.getState().get("status") === "unavailable") {
        this.current?.stop();
        this.current = undefined;
        this.currentRoute = undefined;
        this.routeUrl = undefined;
        const errorView = new ErrorView({
          model: {
            message: "Session unavailable. Retry to check your session.",
          },
        });
        this.listenTo(errorView, {
          retry: () => {
            void this.refreshSession();
          },
        });
        (this.getView() as ViewInstance).getRegion("content")!.show(errorView);
        return;
      }
      history.replaceState({}, "", "/login");
      route = parseRoute(new URL(location.href));
    }
    const url = location.pathname + location.search;
    if (this.routeUrl === url) return;
    this.routeUrl = url;
    this.header.set("path", location.pathname);
    if (
      route.key === this.currentRoute?.key &&
      this.current?.isRunning() &&
      (this.current instanceof HomeApplication ||
        this.current instanceof ProfileApplication) &&
      "feed" in route
    ) {
      this.currentRoute = route;
      this.current.setQuery(route.feed);
      return;
    }
    this.current?.stop();
    this.currentRoute = route;
    const region = (this.getView() as ViewInstance).getRegion("content")!;
    if (route.kind === "missing") {
      this.current = undefined;
      region.show(new NotFoundView());
      this.focusPage(moveFocus);
      return;
    }
    const name =
      route.kind === "login" || route.kind === "register" ? "auth" : route.kind;
    const child = (this.current = this.getChildApp(name)!);
    region.show(new LoadingView());
    document.title = "Loading… — Conduit";
    try {
      const result = await child.start({
        region,
        ...route,
        ...("feed" in route ? { query: route.feed } : {}),
        mode: route.kind,
      });
      if (result && this.current === child && this.routeUrl === url)
        this.focusPage(moveFocus);
    } catch (error) {
      child.stop();
      this.routeUrl = undefined;
      const view = new ErrorView({
        model: { message: errorMessages(error).join(". ") },
      });
      this.listenTo(view, { retry: () => this.dispatch() });
      region.show(view);
      this.focusPage(moveFocus);
    }
  }
  focusPage(moveFocus: boolean) {
    const element =
      this.getView()?.el.querySelector<HTMLElement>("main h1") ??
      this.getView()?.el.querySelector<HTMLElement>("main");
    if (element) {
      document.title = `${element.querySelector("h1")?.textContent || (element.tagName === "H1" ? element.textContent : "Conduit")} — Conduit`;
      if (moveFocus) element.focus();
    }
  }
  onBeforeStop() {
    window.removeEventListener("popstate", this.onPopState);
    window.removeEventListener("storage", this.onStorage);
    this.current = undefined;
    this.currentRoute = undefined;
    this.routeUrl = undefined;
  }
  onDestroy() {
    this.header.destroy();
  }
}
