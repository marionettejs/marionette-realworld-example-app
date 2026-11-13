import {
  type ApplicationOptions,
  type ViewInstance,
  type LifecycleContext,
} from "marionette";
import { Model } from "@mnjs/data";
import {
  RouteApplication,
  Router,
  type ActiveMatch,
  type Driver,
  type RouterInstance,
  type RouteApplicationInstance,
} from "@mnjs/router";
import { SessionApplication, type Context } from "./session";
import { ShellView, HeaderView, SessionStatusView } from "./shell";
import { pageRoutes } from "./routes";
import { HomeApplication } from "../features/home/application";
import { ProfileApplication } from "../features/profile/application";
import { ArticleApplication } from "../features/article/application";
import { AuthApplication } from "../features/auth/application";
import { EditorApplication } from "../features/editor/application";
import { SettingsApplication } from "../features/settings/application";
import { ErrorView, LoadingView, NotFoundView } from "../shared/views";
import { errorMessages } from "../shared/api";
import type { User } from "../shared/types";
const pageApplications = {
  home: HomeApplication,
  profile: ProfileApplication,
  article: ArticleApplication,
  auth: AuthApplication,
  editor: EditorApplication,
  settings: SettingsApplication,
} satisfies Record<string, new (context: Context) => RoutedPage>;
type RoutedPage = RouteApplicationInstance & {
  routeOptions(match: ActiveMatch): Record<string, unknown>;
};
class SessionUnavailable extends Error {}

export class ConduitApplication extends RouteApplication {
  // Native fields configure route compilation after runtime children receive context.
  childApps = pageApplications as unknown as NonNullable<
    ApplicationOptions["childApps"]
  >;
  routes = pageRoutes;
  session: SessionApplication;
  router: RouterInstance;
  header = new Model<{ user: User | null; path: string }>({
    user: null,
    path: "/",
  });
  routeTask: Promise<void> = Promise.resolve();
  private hasRouted = false;
  private moveFocus = false;
  private focusAfterRoute = false;
  private onStorage = (event: StorageEvent) => {
    if (event.key === "jwtToken" || event.key === null)
      void this.refreshSession();
  };
  constructor(driver?: Driver) {
    super({ region: { el: "#app" } });
    this.router = this.addChildApp(
      "navigation",
      new Router({
        driver,
        notFound: "missing",
        owns: (url) =>
          !/^\/(?:api|assets|src|node_modules|@vite|@id)(?:\/|$)/.test(
            url.pathname,
          ) &&
          !["/default-avatar.svg", "/favicon.ico", "/styles.css"].includes(
            url.pathname,
          ),
      }),
    );
    this.listenTo(this.router, {
      "route:error": (error: unknown) => this.showNavigationError(error),
      route: (match: ActiveMatch) => {
        this.moveFocus = this.hasRouted;
        this.hasRouted = true;
        this.focusAfterRoute = false;
        this.header.set("path", match.url.pathname);
      },
      "route:ready": () => this.focusPage(this.focusAfterRoute),
    });
    this.session = this.addChildApp("session", new SessionApplication());
    const context: Context = {
      session: this.session,
      navigate: (path, options) => this.navigate(path, options),
    };
    for (const [name, Page] of Object.entries(pageApplications)) {
      const page = this.addChildApp(name, new Page(context));
      this.listenTo(page, {
        "before:start": () => {
          if (!page.isRunning()) this.showLoading();
        },
        "page:loading": () => this.showLoading(),
      });
    }
    this.mountRoutes(this.router);
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
    if (previous === this.session.user()?.username && this.getCurrent()) return;
    this.resetDestination();
    this.dispatch();
  }
  sessionChanged() {
    this.header.set({ user: this.session.user(), path: location.pathname });
  }
  resetDestination() {
    this.clear();
    this.hasRouted = false;
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
    this.focusAfterRoute = this.moveFocus;
    this.resetDestination();
    const view = new ErrorView({
      model: { message: errorMessages(error).join(". ") },
    });
    this.listenTo(view, { retry: () => this.dispatch() });
    (this.getView() as ViewInstance).getRegion("content")!.show(view);
  }
  routeTo(match: ActiveMatch) {
    this.routeTask = super.routeTo(match).then(() => {});
    return this.routeTask;
  }
  childRouteOptions(match: ActiveMatch, mount: string) {
    return (this.getChildApp(mount) as RoutedPage).routeOptions(match);
  }
  onBeforeRoute(match: ActiveMatch) {
    const access = match.meta.requiresUser;
    const required =
      typeof access === "function" ? access(match) : access === true;
    if (!required || this.session.user()) return;
    if (this.session.getState().get("status") === "unavailable")
      throw new SessionUnavailable();
    this.navigate("/login", { replace: true });
  }
  showLoading() {
    if (!this.isRunning()) return;
    this.focusAfterRoute = this.moveFocus;
    (this.getView() as ViewInstance)
      .getRegion("content")!
      .show(new LoadingView());
    document.title = "Loading… — Conduit";
  }
  showMissing() {
    this.focusAfterRoute = this.moveFocus;
    (this.getView() as ViewInstance)
      .getRegion("content")!
      .show(new NotFoundView());
  }
  handleRouteError(error: unknown, match: ActiveMatch) {
    if (match.signal.aborted || !this.isRunning()) return;
    if (error instanceof SessionUnavailable) {
      this.showSessionUnavailable();
      return;
    }
    this.showNavigationError(error);
  }
  showSessionUnavailable() {
    this.focusAfterRoute = this.moveFocus;
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
