# Marionette v5 RC2 source review — 2026-10-04

Reviewed the application source matching [the final application commit](https://github.com/marionettejs/marionette-realworld-example-app/commit/48b910a2e2c496772d1409c19792a7ef0ce8121d), including concurrent readiness, visual/loading fidelity and bounded cleanup. No application source was changed during this review. [Evidence provenance](metrics/README.md) maps the recorded snapshot to that commit. Installed Marionette and matching adapters/data are published `5.0.0-rc.2`; the packaged Application lifecycle, retained-restart and CollectionView contracts govern this review.

## Conclusion

No new concrete RC2 API or lifecycle defect was found. This is a faithful RealWorld frontend with idiomatic feature ownership, rather than a generic framework built beside Marionette. Full upstream/live-backend acceptance remains unverified; the result is not a certification claim.

## Reviewed boundaries

- The root Application owns shell, destinations and session coordination. Registered feature Applications own requests and children. Regions and CollectionViews manage placement and rows through public APIs.
- Home/Profile prepare off-screen layouts to resolve child Regions and start independent feed readiness concurrently with tags/profile requests. Article starts comments concurrently using the route slug. These preparations create owned resources; root failure handling explicitly stops failed destinations, and stop/destroy traverses children and disposes prepared roots. This follows RC2's documented preparation cleanup responsibility.
- Current readiness data commits in `onStart`. Retained restarts preserve layout and local drafts. Resource navigation uses stop/start; independently pending writes use cancellable Operations rather than a completed preparation signal.
- Article heading observes title; body checks body/tag values to avoid Markdown reparsing on unrelated changes. Comment rows observe pending state rather than composer typing. Lifecycle/event definitions use supported hooks and literal event names.
- Native Application subclasses and `View.extend` are both supported. Type-only state declarations preserve native Model typing without runtime overrides. Direct method-name bindings replace forwarding callbacks; transformed event payloads retain explicit handlers. Feed loading uses start for initial Region placement and restart for retained refresh. The broad Context remains a coupling tradeoff, not an API misuse; no additional dependency framework is warranted.
- Profile typography, article tag placement and editor/mobile presentation now follow the base theme more closely. No new product feature, caching, prefetching or benchmark-specific source optimization was introduced.

## Remaining presentation differences

The feed now uses the padded `article-preview` loading block and hides retained rows/pagination during loading. It observes only pending changes and toggles visibility without rerendering the layout or reconstructing child Views. Failure restores retained results and Retry; three-engine loading tests exercise this behavior. Angular's green signup button, explanatory banner and footer behavior are reference-specific choices; the user asked not to copy those customizations. These choices were reviewed without further source edits.

## Fresh verification

Typecheck, repository lint, production build and all 3 unit tests passed. All 93 existing development lifecycle/journey checks passed across Chromium, Firefox and WebKit, using a temporary test configuration on port 5174 to preserve the requested dev server on 5173. Existing tests were unchanged. The first temporary-config attempt failed before tests because its server cwd was `/tmp`; setting the temporary server cwd to the project resolved that infrastructure error.

Fresh production checks also passed all 19 Chromium journeys; the normal-API build was restored afterward. Earlier concurrency/error probe evidence and visual checks remain in the development journal and visual report; they were inspected, not represented as freshly rerun here. Browser tests use controlled responses and do not verify backend authorization. The current shared benchmark evidence is in [the comparison](benchmark-comparison.md).
