# Ownership and lifecycle

This example uses named Applications for asynchronous workflows, readiness, composition, and cleanup. Views own presentation and local editing. Read alongside the installed [5.0.0 architecture guide](../node_modules/marionette/docs/architecture.md), [records lesson](../node_modules/marionette/docs/records.md), and [composed source](../node_modules/marionette/examples/records/src/records-application.js).

## Finding a workflow

Each directory under `src/features` has an `application.ts` coordination entrypoint and a `view.ts` or `views.ts` presentation file. Related small Views stay together; there is no barrel or generic page layer to traverse.

| Feature  | Coordination                                                                               | Presentation                                                                          |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Auth     | [authenticate and accept session](../src/features/auth/application.ts)                     | [login/register form](../src/features/auth/view.ts)                                   |
| Editor   | [prepare, authorize, publish, preserve newer edits](../src/features/editor/application.ts) | [text and tag editing](../src/features/editor/view.ts)                                |
| Settings | [profile update and logout intent](../src/features/settings/application.ts)                | [settings form](../src/features/settings/view.ts)                                     |
| Home     | [tags and child feed](../src/features/home/application.ts)                                 | [layout, tabs, tags](../src/features/home/views.ts)                                   |
| Profile  | [profile, follow, child feed](../src/features/profile/application.ts)                      | [layout, header, tabs](../src/features/profile/views.ts)                              |
| Feed     | [query, pagination, favorites](../src/features/feed/application.ts)                        | [layout, CollectionView, article row, status, pages](../src/features/feed/views.ts)   |
| Article  | [article readiness and actions, child comments](../src/features/article/application.ts)    | [layout, heading, body, two metadata bars](../src/features/article/views.ts)          |
| Comments | [collection, draft, post/delete](../src/features/comments/application.ts)                  | [layout, composer, CollectionView and comment row](../src/features/comments/views.ts) |

[ConduitApplication](../src/app/application.ts) owns browser navigation, the persistent shell, SessionApplication, and registered page Applications. Home/Profile own a FeedApplication; Article owns a CommentsApplication. Home, Profile, and Article prepare their layouts off-screen and start registered children alongside their own readiness requests. Child Applications keep request and error ownership. The parent mounts after its own data is ready; an abandoned initial start stops the parent and descendants before displaying the page error.

[FormApplication](../src/shared/form-application.ts) shares only save/status/teardown policy. Concrete Applications define typed fields and completion decisions. [Field template helpers](../src/shared/form-fields.ts) produce markup; they do not build Views, manage requests, or define a form schema. Auth shares login/register presentation because those workflows differ by one field and labels; Editor and Settings are independent Views.

## Why native Applications and `View.extend`?

Both are supported 5.0.0 APIs. This example deliberately uses native `class … extends Application` for explicit instance-owned models, children, operations, and typed lifecycle methods. It uses `View.extend` and `CollectionView.extend` for declarative templates, Regions, event maps, and concise option inference from a typed `initialize`. The [packaged TypeScript guide](../node_modules/marionette/docs/guides/typescript.md#constructors-instances-options-and-state) documents that inference, including `InstanceType<typeof ViewClass>`.

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

Editor fields include observable saved slug, so the View derives its editing heading from data. Completion compares the submitted text and copied tag list with the current draft. Unchanged drafts navigate to the article; newer edits stay in place with a notice and the saved editor URL. Editor emits `draft:saved`; the root observes that intent and owns the history replacement. Comment completion similarly clears only unchanged submitted text. Nothing silently persists drafts across page teardown.

## Presentation, cleanup, and verification

Regions own View replacement/destruction; CollectionViews own article/comment rows. Article's two action bars observe one model; successful actions commit data and pending status together. Heading observes title; body observes text and tag values, so both reflect full server responses without rendering for unrelated status changes or an equal tag array returned by a favorite response. Comment rows observe pending state, not composer typing. Body and comment draft are separate Views. Small static tag/tab/pagination lists use template iteration because they have no independent observable lifetime. Lit updates controls in place, preserving typing during status changes.

Native Application classes declare the concrete `getState` return type without overriding its runtime implementation. `createState` still creates the owned Model; Marionette retains and disposes it. Direct event forwarding uses method-name bindings, while callbacks remain where event payloads need transformation.

Applications use `viewEvents` for root intent and `listenTo` for error/status Views. Comment intents are namespaced to avoid triggering article deletion. Destroyed sources release incoming listeners. No blanket `stopListening()` runs on stop: root's session subscriptions must survive stop/start. Window listeners are installed once per root run and removed on stop; HMR destroys the root.

[Lifecycle tests](../tests/lifecycle.spec.ts) exercise retained identity, reconstruction, borrowed-model listener release, descendant destruction, stale preparation/activation, session/draft races, credential replacement, and feed read/write ordering. [Journeys](../tests/journeys.spec.ts) cover product behavior, newer typing, favorites pagination, errors, auth, and responsive interaction.

The backend enforces authentication and ownership. The RealWorld JWT debug interface shares localStorage's script-access boundary.
