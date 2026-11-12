import {
  Application,
  type ViewInstance,
  type ApplicationInstance,
  type LifecycleContext,
} from "marionette";
import { Model } from "@mnjs/data";
import { Router, historyDriver } from "@mnjs/router";
import { SessionApplication, type Context } from "./session";
import { ShellView, HeaderView, SessionStatusView } from "./shell";
import { routeFor, routes, requiresUser, type Route } from "./routes";
import { HomeApplication } from "../features/home/application";
import { ProfileApplication } from "../features/profile/application";
import { ArticleApplication } from "../features/article/application";
import { AuthApplication } from "../features/auth/application";
import { EditorApplication } from "../features/editor/application";
import { SettingsApplication } from "../features/settings/application";
import { ErrorView, LoadingView, NotFoundView } from "../shared/views";
import { errorMessages } from "../shared/api";
import type { User } from "../shared/types";
export class ConduitApplication extends Application {
  session: SessionApplication;
  router = this.addChildApp(
    "navigation",
    new Router({
      driver: historyDriver(),
      routes,
      notFound: "missing",
      owns: (url) =>
        !/^\/(?:api|assets|src|node_modules|@vite|@id)(?:\/|$)/.test(
          url.pathname,
        ) &&
        !["/default-avatar.svg", "/favicon.ico", "/styles.css"].includes(
          url.pathname,
        ),
      handler: (match) => {
        this.routeTask = this.showRoute(
          ++this.navigation,
          routeFor(match, match.url),
        );
        return this.routeTask;
      },
    }),
  );
  header = new Model<{ user: User | null; path: string }>({
    user: null,
    path: "/",
  });
  current?: ApplicationInstance<object, unknown>;
  currentRoute?: Route;
  routeTask: Promise<void> = Promise.resolve();
  private routeUrl?: string;
  private navigation = 0;
  private onStorage = (event: StorageEvent) => {
    if (event.key === "jwtToken" || event.key === null)
      void this.refreshSession();
  };
  constructor() {
    super({ region: { el: "#app" } });
    this.listenTo(this.router, {
      "route:error": (error: unknown) => this.showNavigationError(error),
    });
    this.session = this.addChildApp("session", new SessionApplication());
    const context: Context = {
      session: this.session,
      navigate: (path, options) => this.navigate(path, options),
    };
    this.addChildApp("home", new HomeApplication(context));
    this.addChildApp("profile", new ProfileApplication(context));
    this.addChildApp("article", new ArticleApplication(context));
    this.addChildApp("auth", new AuthApplication(context));
    const editor = this.addChildApp("editor", new EditorApplication(context));
    this.listenTo(editor, {
      "draft:saved": (slug: string) => this.replaceEditorUrl(slug),
    });
    this.addChildApp("settings", new SettingsApplication(context));
    this.listenTo(this.session, {
      "signed:out": (path: string) => {
        if (!this.isRunning()) return;
        this.resetDestination();
        this.navigate(path);
      },
    });
    this.listenTo(this.session.getState(), {
      change: () => this.sessionChanged(),
    });
  }
  async prepareStart(_options: unknown, { signal }: LifecycleContext) {
    let token = this.session.token();
    await this.session.start();
    // Storage events can occur before the shell installs its listener.
    while (token !== this.session.token()) {
      signal.throwIfAborted();
      token = this.session.token();
      await this.session.restart();
    }
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
        this.session.clear("/");
      },
    });
    this.showView();
    this.sessionChanged();
    window.addEventListener("storage", this.onStorage);
    this.routeTask = this.router
      .start()
      .then(async () => {
        const initial = await this.router.getInitialDispatch();
        if (initial?.status === "failed")
          this.showNavigationError(initial.error);
      })
      .catch((error) => this.showNavigationError(error));
  }
  async refreshSession() {
    const previous = this.session.user()?.username;
    const task = this.session.restart();
    const current = this.session.authority();
    const accepted = await task;
    if (!accepted || !current() || !this.isRunning()) return;
    if (previous === this.session.user()?.username && this.current) return;
    this.resetDestination();
    this.dispatch();
  }
  sessionChanged() {
    this.header.set({ user: this.session.user(), path: location.pathname });
  }
  resetDestination() {
    this.navigation++;
    this.current?.stop();
    this.current = undefined;
    this.currentRoute = undefined;
    this.routeUrl = undefined;
  }
  replaceEditorUrl(slug: string) {
    if (this.currentRoute?.kind !== "editor") return;
    const url = `/editor/${encodeURIComponent(slug)}`;
    // Saving a draft changes its URL without replacing its owning feature.
    this.currentRoute = { kind: "editor", key: url, slug };
    this.routeUrl = url;
    this.header.set("path", url);
    this.navigate(url, { replace: true });
  }
  navigate(path: string, { replace = false }: { replace?: boolean } = {}) {
    const result = this.router.navigate(path, {
      history: replace ? "replace" : "auto",
      focusReset: "manual",
      scroll: "manual",
    });
    this.routeTask = result.finished.then(
      () => {},
      (error) => this.showNavigationError(error),
    );
  }
  dispatch() {
    this.routeTask = this.router.refresh().then(
      () => {},
      (error) => this.showNavigationError(error),
    );
  }
  showNavigationError(error: unknown) {
    if (!this.isRunning()) return;
    this.resetDestination();
    const view = new ErrorView({
      model: { message: errorMessages(error).join(". ") },
    });
    this.listenTo(view, { retry: () => this.dispatch() });
    (this.getView() as ViewInstance).getRegion("content")!.show(view);
  }
  async showRoute(navigation: number, destination: Route) {
    if (!this.isRunning()) return;
    const moveFocus = !!this.currentRoute;
    const route = this.accessibleRoute(destination);
    if (!route) return;
    const url = location.pathname + location.search;
    if (this.routeUrl === url) return;
    this.routeUrl = url;
    this.header.set("path", location.pathname);
    if (this.updateRetainedRoute(route)) return;
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
      if (
        result &&
        navigation === this.navigation &&
        this.current === child &&
        this.routeUrl === url
      )
        this.focusPage(moveFocus);
    } catch (error) {
      if (navigation !== this.navigation || !this.isRunning()) return;
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
  accessibleRoute(route: Route) {
    if (requiresUser(route) && !this.session.user()) {
      if (this.session.getState().get("status") === "unavailable") {
        this.showSessionUnavailable();
        return undefined;
      }
      this.navigate("/login", { replace: true });
      return undefined;
    }
    return route;
  }
  updateRetainedRoute(route: Route): boolean {
    if (
      route.key === this.currentRoute?.key &&
      this.current?.isRunning() &&
      (this.current instanceof HomeApplication ||
        this.current instanceof ProfileApplication) &&
      "feed" in route
    ) {
      this.currentRoute = route;
      this.current.setQuery(route.feed);
      return true;
    }
    return false;
  }
  showSessionUnavailable() {
    this.resetDestination();
    const view = new ErrorView({
      model: { message: "Session unavailable. Retry to check your session." },
    });
    this.listenTo(view, {
      retry: () => {
        void this.refreshSession();
      },
    });
    (this.getView() as ViewInstance).getRegion("content")!.show(view);
  }
  focusPage(moveFocus: boolean) {
    const root = this.getView()?.el;
    const heading = root?.querySelector<HTMLElement>(
      "main h1[tabindex], main h4[tabindex]",
    );
    document.title = `${heading?.textContent || "Conduit"} — Conduit`;
    if (moveFocus)
      (heading ?? root?.querySelector<HTMLElement>("main"))?.focus();
  }
  onBeforeStop() {
    window.removeEventListener("storage", this.onStorage);
    this.resetDestination();
  }
  onDestroy() {
    this.header.destroy();
  }
}
