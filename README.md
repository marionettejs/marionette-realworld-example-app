# Conduit · Marionette v5

A RealWorld frontend built with **published Marionette 5.0.0-rc.2**, matching RC2 companions, TypeScript, Lit templates, and observable `@mnjs/data` Models/Collections. It implements authentication, global/followed/tag feeds, pagination, profiles, following, favorites, article creation/editing/deletion, Markdown, comments, and settings using the framework-neutral Conduit markup and shared theme.

## Run locally

Requires Node **24+** and npm.

```sh
nvm use
npm ci --ignore-scripts
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:5173). Copy `.env.example` to `.env.local` to change `VITE_API_URL`; restart Vite after changing it. The default is `https://api.realworld.show/api`. Use only disposable demo credentials, or point to a local specification-compatible backend. This repository contains a frontend, not a backend server.

```sh
npm run build
npm run preview
```

The preview serves `dist`. Vite handles direct path links locally. Another host must serve `index.html` for application routes such as `/article/:slug` and `/profile/:username`.

## Architecture tour

Start with [the ownership guide](docs/architecture.md), then follow:

1. [Setup](src/setup.ts): configure the published Lit DOM adapter and native DataApi/StateApi once.
2. [ConduitApplication](src/app/application.ts): retain the shell, own browser navigation and registered child Applications, handle destination readiness/failure.
3. [HomeApplication](src/features/home/application.ts) and [FeedApplication](src/features/feed/application.ts): compose a feature; repeat preparation with `restart` while retaining the layout; let CollectionView own rows.
4. [ArticleApplication](src/features/article/application.ts) and [CommentsApplication](src/features/comments/application.ts): coordinate sibling metadata Views through one observable model and give comments their own lifetime.
5. [Auth](src/features/auth/application.ts), [Editor](src/features/editor/application.ts), and [Settings](src/features/settings/application.ts): each feature has its own Application and View file. The [shared save policy](src/shared/form-application.ts) keeps drafts stable during status changes.

Each feature directory separates coordination (`application.ts`) from presentation (`view.ts` or `views.ts`). See [the inheritance-style rationale](docs/architecture.md#why-native-applications-and-viewextend) for the deliberate native Application / `View.extend` convention.

The installed package's `docs/architecture.md`, `docs/records.md`, examples, API references, declarations, ESLint rule, and lookup tool govern this implementation. No v4 APIs, local framework builds, or source aliases are used.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npx playwright install chromium firefox webkit
npm test -- --workers=3
npm run test:production
```

The Playwright configuration starts/stops its own local server on port 5173. Close another server on that port first. Tests automatically intercept API requests with disposable local fixture data; the test server's API base points to localhost, so missing interception cannot write to the public service. No real accounts are required. Failure traces go to ignored `test-results/`.

`npm run test:production` builds a fixture-configured production bundle and runs user journeys in Chromium; lifecycle inspection runs against the development build. **Run `npm run build` again afterward for a normal API-configured bundle.** The required RealWorld `window.__conduit_debug__` interface is available in both builds; the extra Application inspection handle exists only in development.

The browser tests exercise workflows against local API fixtures. Run them against a specification-compatible backend separately to verify integration.

### Official RealWorld suite

Like the Angular and Vue examples, this repository pins the official RealWorld specification and unchanged browser tests through a Git submodule. Initialize it before running the shared suite:

```sh
git submodule update --init --recursive
npx playwright install chromium
npm run test:e2e:list
npm run test:e2e -- health.spec.ts \
  --grep 'app should load successfully|can navigate to login page|can navigate to register page'
```

The separate configuration extends `realworld/specs/e2e/playwright.base.ts` and starts Vite on port **5174**, leaving a dev instance on 5173 available. The command above runs three read-only UI smoke tests. The full suite runs with `npm run test:e2e`; it creates disposable users/articles and performs writes and deletions against the public demo API by default. Run it only against a backend authorized for those test operations. No real credentials are needed.

To configure another specification-compatible backend, set `API_BASE` for both the test runner and application:

```sh
API_BASE=http://127.0.0.1:3000/api TEST_MODE=spa npm run test:e2e
```

The shared SPA tests expect seeded cross-user data such as `johndoe`. Some upstream mocks and the API health check hard-code the public API URL, so a local endpoint cannot make every unchanged test portable. Report those limitations separately from application failures. Full official-suite acceptance remains unverified; the controlled tests above do not substitute for it.

## Behavior notes

- JWT uses the specification's `localStorage.jwtToken` key and `Authorization: Token …` header. A 401 clears the session. Same-user verification preserves active drafts. Temporary verification failure retains the token and offers Retry; new writes wait for successful verification. Credential changes revoke old response authority.
- Article text is parsed with Marked and sanitized with DOMPurify. Other user content uses escaped Lit expressions. The server remains responsible for authentication and ownership enforcement.
- Tags can be added/removed during creation and editing, following the current OpenAPI UpdateArticle schema and backend acceptance tests. Article-list responses omit body; full article responses include it.
- Save status never replaces the form. Newer comment text remains after an earlier comment is posted. If article text changes while publishing, the editor retains it and saves subsequent edits to the returned slug.
- Leaving a page discards its unsaved draft and cancels its client-side operations. Cancellation prevents late UI/session updates; it cannot undo a server write already accepted.
- Fonts and Ionicons load from the sources recommended by the RealWorld templates. The shared theme and default avatar are served locally. Offline fonts fall back to system fonts.

Shared theme and avatar: [RealWorld](https://github.com/realworld-apps/realworld), MIT, revision `ebbcdeb8d55b42a3a613c787560498b8ef10003f`. The starter's license, logo, code of conduct, and favicon are retained.
