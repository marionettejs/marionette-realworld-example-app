# Ownership and lifecycle

This example uses named Applications for asynchronous workflows, readiness, composition, and cleanup. Views own presentation and local editing. Read alongside the installed [5.1.0 architecture guide](../node_modules/marionette/docs/architecture.md), [records lesson](../node_modules/marionette/docs/records.md), and [composed source](../node_modules/marionette/examples/records/src/records-application.js).

## Finding a workflow

Each directory under `src/features` has an `application.ts` coordination entrypoint and a `view.ts` or `views.ts` presentation file. Routed features also own a pure `routes.ts` declaration, so URL contracts can be checked without importing their DOM templates. Related small Views stay together; there is no barrel or generic page layer to traverse.

| Feature  | Coordination                                                                                                              | Presentation                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Auth     | [authenticate and accept session](../src/features/auth/application.ts)                                                    | [login/register form](../src/features/auth/view.ts)                                   |
| Editor   | [route owner](../src/features/editor/application.ts), [draft readiness/save](../src/features/editor/draft-application.ts) | [text and tag editing](../src/features/editor/view.ts)                                |
| Settings | [profile update and logout intent](../src/features/settings/application.ts)                                               | [settings form](../src/features/settings/view.ts)                                     |
| Home     | [tags and child feed](../src/features/home/application.ts)                                                                | [layout, tabs, tags](../src/features/home/views.ts)                                   |
| Profile  | [profile, follow, child feed](../src/features/profile/application.ts)                                                     | [layout, header, tabs](../src/features/profile/views.ts)                              |
| Feed     | [query, pagination, favorites](../src/features/feed/application.ts)                                                       | [layout, CollectionView, article row, status, pages](../src/features/feed/views.ts)   |
| Article  | [article readiness and actions, child comments](../src/features/article/application.ts)                                   | [layout, heading, body, two metadata bars](../src/features/article/views.ts)          |
| Comments | [collection, draft, post/delete](../src/features/comments/application.ts)                                                 | [layout, composer, CollectionView and comment row](../src/features/comments/views.ts) |

[ConduitApplication](../src/app/application.ts) extends `RouteApplication` and owns browser navigation, the persistent shell, SessionApplication, and registered page Applications. Home/Profile own a FeedApplication; Article owns a CommentsApplication. Home, Profile, and Article prepare their layouts off-screen and start registered children alongside their own readiness requests. Child Applications keep request and error ownership. The parent mounts after its own data is ready; an abandoned initial start stops the parent and descendants before displaying the page error.

The root declares feature mount prefixes and the named content Region. Home, Profile, Article, Auth, Editor, and Settings are `RouteApplication` owners with their own leaf routes. `mountRoutes` compiles the declared tree; `routeBranch` selects mounted children by their mount parameters and awaits feature handlers. The root delegates start data to each feature's `routeOptions` through the public `childRouteOptions` hook. There is no central `routeFor` switch, route-kind union, or page dispatcher. Feed, Comments, and Session remain ordinary Applications.

Home owns its global/tag/following feed routes and query conversion; Profile owns its default/favorites leaves. Their local handlers update the existing Feed only when the query changes. Profile username and article slug belong to mount keys, so changing a resource stops/starts its owner. Auth owns login/register and changes its form mode locally. Feature route metadata declares access requirements; the root handles verified-user checks, login redirects, unavailable sessions, loading/errors, and focus. Required requests remain in feature preparation. Loading is observed from feature starts, so retained feed queries keep their layout.

Editor owns a registered draft Application. Its leaf handler selects that draft by requested slug. A newly saved slug already present in the draft model retains the same draft, text, focus, and caret; New Article or a different requested article starts a new draft lifetime. This extra owner is intentional: automatic mount keys cannot adopt a saved slug without reconstructing the selected Application. Moving URL policy here removes the root's editor special case. `EditorDraftApplication` keeps authorization, loading, fields, save operations, and View ownership.

A registered `navigation` child is the single browser Router. Bootstrap uses native Navigation when available and catches a throwing capability getter. Only fallback clients asynchronously import `@mnjs/router/history` before Application construction. No Service Worker/precache is configured; future preload/precache changes must leave History-only assets lazy. Stop/start retains route registrations and explicitly restarts the Router; destroy unmounts the root's routes. Static assets/API paths and browser-owned link behavior stay outside application routing.

The root's native `childApps` field is route-compilation metadata assigned after base construction. Runtime instances are explicitly registered with their Context before `mountRoutes` compiles the tree. The metadata-only use needs a type assertion because core's `childApps` type describes automatic no-argument construction. No optional Context or service locator is introduced.

[FormApplication](../src/shared/form-application.ts) shares only save/status/teardown policy. Concrete Applications define typed fields and completion decisions. [Field template helpers](../src/shared/form-fields.ts) produce markup; they do not build Views, manage requests, or define a form schema. Auth shares login/register presentation because those workflows differ by one field and labels; Editor and Settings are independent Views.

## Why native Applications and `View.extend`?

Both are supported 5.1.0 APIs. This example deliberately uses native Application classes (the root extends Router's `RouteApplication`) for explicit instance-owned models, children, operations, and typed lifecycle methods. It uses `View.extend` and `CollectionView.extend` for declarative templates, Regions, event maps, and concise option inference from a typed `initialize`. The [packaged TypeScript guide](../node_modules/marionette/docs/guides/typescript.md#constructors-instances-options-and-state) documents that inference, including `InstanceType<typeof ViewClass>`.

Native View subclasses are also valid. Using them uniformly here would require additional option declarations/constructors and careful prototype getters for configuration, without changing ownership. Conversely, Applications could use `.extend`; native classes make their owned instance resources especially visible. This is a local readability convention, not a claim that either syntax is preferred by the framework.

Construction timing matters more than syntax: native fields run **after** `super()` and Marionette initialization. Construction-time configuration (`createState`, `viewEvents`) therefore uses prototype methods/getters; instance models and Operations use fields. A typed `initialize` on a View declares its borrowed sources/options without overwriting framework initialization.

## Async ownership and session authority

Application-owned async is the default here. A narrow View-local model save can be appropriate when a persistence-capable model owns that operation; Marionette permits it. That exception does not justify putting feature loading, navigation, shared state, or request coordination in Views. This example's native `@mnjs/data` Models have no fetch/save methods: [the explicit API](../src/shared/api.ts) owns HTTP and response validation, while Applications own every network workflow.

[SessionApplication](../src/app/session.ts) owns observable user/status, verification, and credential lifetime. Changing credentials aborts requests issued under the previous credentials; transport also checks token identity after awaiting. Protected writes require authenticated status. Shared form completion checks captured authority too, including when a test API ignores abort.

Same-user verification retains the active page and draft. Temporary verification failure under unchanged credentials keeps the last verified user and draft, displays Retry, and blocks new writes until verification succeeds. Changed identity or lost access reconstructs the destination. Cancelled/superseded session readiness cannot cause a root redispatch. Root startup rechecks credentials changed before its storage listener was installed. Explicit sign-out and expired credentials use one root navigation subscription to `signed:out`. A server 401 for current credentials clears the session and stops the page, including its draft. Current-user verification also clears the session on other 4xx responses, as required by the [RealWorld user-fetch contract](https://github.com/realworld-apps/realworld/blob/ebbcdeb8d55b42a3a613c787560498b8ef10003f/specs/e2e/user-fetch-errors.spec.ts). Other endpoints still display their validation errors. Temporary network/server failure retains the token and draft. Superseded verification returns no state to commit.

## Readiness and operations

`prepareStart` returns required data; `onStart` applies it. The caller handles rejected starts. Marionette prevents cancelled preparation from activating, including when a dependency ignores abort. Root navigation also checks its current dispatch before handling activation errors.

| Owner                | Retained operation                                                                    | Reconstruction / draft boundary                                              |
| -------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Root                 | `restart()` retains shell and page                                                    | `stop()` then `start()` replaces shell and descendants                       |
| Session              | `restart()` verifies current credentials                                              | No UI; credential changes revoke old request authority                       |
| Feed                 | `load(query)` uses `restart`; layout/status/list survive                              | New membership replaces rows after active writes settle; stop cancels writes |
| Home/Profile         | Same-feature readiness retains parent and child Regions; reopens the child feed query | Route identity changes use stop/start                                        |
| Article              | Same-article readiness retains layout and running Comments draft                      | New article routes use stop/start                                            |
| Comments             | Same-article readiness retains composer text and layout                               | Stop clears draft and collection                                             |
| Auth/Editor/Settings | No readiness-refresh control; save status retains the View and draft                  | Activation initializes fields; navigation uses stop/start and discards draft |

The UI uses retained refresh for feed queries and session verification. Resource navigation uses stop/start. Direct lifecycle checks verify same-feature Region retention and reconstruction.

[Operation](../src/shared/operation.ts) permits one pending write per owner (per article for feed favorites), aborts on stop, and guards callbacks after cancellation. It is separate from readiness. Backend writes may already have committed when the client stops waiting.

Feed loading uses the base `article-preview` block. Its layout borrows the feed status Model and toggles `hidden` on the existing result and pagination containers while a query is pending. It does not rerender the layout: Marionette layout rendering destroys Region children. Successful readiness updates the collection and pagination; a failed refresh restores previous results alongside the existing Retry error. Model bindings release automatically when the layout is destroyed.

Feed owns one operation-to-promise map for cancellation and awaiting active favorites. Feed readiness waits for those writes before reading. A write that starts during a read invalidates its snapshot, so preparation repeats the query before committing. Own-favorites membership refresh waits for all sibling writes, then requeries membership/count and refills the page. Removing the last result from a later page replaces the URL with the last valid page, preserving browser Back behavior. Row write errors stay on the row and clear on resubmission; query Retry belongs to query errors.

Editor fields include observable saved slug, so the View derives its editing heading from data. Completion compares the submitted text and copied tag list with the current draft. Unchanged drafts navigate to the article; newer edits stay in place with a notice and the saved editor URL. EditorDraft emits `draft:saved`; its Editor route owner observes the intent and requests URL replacement while retaining the matching draft. Comment completion similarly clears only unchanged submitted text. Nothing silently persists drafts across page teardown.

## Presentation, cleanup, and verification

### Template and directive boundaries

`html` builds template values; it does not own events, requests, child selection, or View lifetimes. Forms use delegated View `events`/`triggers`; article/comment rows use CollectionViews; feature layouts use named Regions. Small tag/tab/pagination lists have no separate observable child lifetime, so template iteration is sufficient.

The only directives are `live` and `unsafeHTML`. Keep `live` on the shared input/textarea helpers and comment composer: it compares the Model value with the actual control property, skips equal writes while typing, and reconciles native DOM changes on the next render even when the Model value has not changed. Plain `.value` bindings compare with the renderer's previous value and miss that last case. Replacing it with `ui` lookups and `onRender` setters would split form synchronization between the template and manual DOM writes. The installed Marionette local-editing guide uses this same binding. Models remain authoritative; delegated input events update the draft.

Keep `unsafeHTML` only inside `markdown`, immediately after Marked and DOMPurify. `ArticleBody` is already the dedicated View owning this rendered content; heading, action bars, and comments are separate Views. A further Markdown View/Region or an `onRender` DOM-fragment insertion would add a placement/update boundary without changing that ownership or removing the need to sanitize. Ordinary user content continues to use escaped expressions. Neither directive replaces Marionette lifecycle management.

Regions own View replacement/destruction; CollectionViews own article/comment rows. Article's two action bars observe one model; successful actions commit data and pending status together. Heading observes title; body observes text and tag values, so both reflect full server responses without rendering for unrelated status changes or an equal tag array returned by a favorite response. Comment rows observe pending state, not composer typing. Body and comment draft are separate Views. Small static tag/tab/pagination lists use template iteration because they have no independent observable lifetime. `@mnjs/html` updates controls in place, preserving typing during status changes.

Native Application classes declare the concrete `getState` return type without overriding its runtime implementation. `createState` still creates the owned Model; Marionette retains and disposes it. Direct event forwarding uses method-name bindings, while callbacks remain where event payloads need transformation.

Applications use `viewEvents` for root intent and `listenTo` for error/status Views. Comment intents are namespaced to avoid triggering article deletion. Destroyed sources release incoming listeners. No blanket `stopListening()` runs on stop: root's session subscriptions must survive stop/start. The storage listener is installed once per root run and removed on stop; the Router owns its driver listeners; HMR destroys the root.

[Lifecycle tests](../tests/lifecycle.spec.ts) exercise retained identity, reconstruction, borrowed-model listener release, descendant destruction, stale preparation/activation, session/draft races, credential replacement, and feed read/write ordering. [Journeys](../tests/journeys.spec.ts) cover product behavior, newer typing, favorites pagination, errors, auth, and responsive interaction.

The backend enforces authentication and ownership. The RealWorld JWT debug interface shares localStorage's script-access boundary.
