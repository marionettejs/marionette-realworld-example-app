# RealWorld submission preparation

## Listing draft

- Repository: https://github.com/marionettejs/marionette-realworld-example-app
- Category: Frontend
- Environment: Web
- Language: TypeScript
- Library/framework: Marionette (the existing CodebaseShow catalog entry)
- Version: published Marionette and matching companions **5.0.0-rc.2**.
- Optional description: Conduit implemented with Marionette v5 RC2 Applications, named Regions, observable Models/Collections, CollectionViews, and Lit templates. Includes authentication, feeds, tags, pagination, profiles, following, favorites, articles, comments, editor, and settings.
- Submission page: https://codebase.show/projects/realworld/implementations/submit
- Demo URL: none yet. A hosted demo is not listed as a requirement in the current official expectations.

The browser form is prepared with repository, category, environment, language, and Marionette. Repository/Issues, README, and framework-star requirements are checked. Feature completeness and the maintainer's future update commitment remain for final review. Nothing has been submitted.

Use `main` as the implementation. Benchmarks, comparisons, and development records are on `benchmarks`; these are supporting material rather than part of the base example.

## Checks before submission

- Public dedicated repository and enabled Issues confirmed through GitHub.
- README contains overview, architecture tour, local setup, and test instructions.
- Marionette's established framework repository is https://github.com/marionettejs/backbone.marionette (7,031 stars at this check). The RC2 release is a version of that framework; it qualifies for the 300-star requirement.
- No Marionette frontend entry appeared in CodebaseShow's current list. No Marionette mention appeared in the 100 discussions inspected; a focused public search also found none. Two historical closed Backbone issues exist (#71 and #152). This is not an exhaustive search of every discussion/comment.
- Existing controlled verification: 3 unit tests, 99 development browser checks across Chromium/Firefox/WebKit, 19 production Chromium journeys, typecheck/lint/build. These use local HTTP fixtures and do not prove backend authorization.
- Newly prepared unchanged official suite: **139 tests in 12 specification files**. Its three selected read-only UI health tests passed in Chromium; logs are in [submission-evidence](submission-evidence/official-smoke.log).
- The full official suite has **not** been run. Do not describe this implementation as officially accepted or fully compliant yet.

## Reproduce official checks

The suite is pinned to official RealWorld revision `ebbcdeb8d55b42a3a613c787560498b8ef10003f`. Its 22 files were verified byte-for-byte; [provenance](submission-evidence/official-provenance.json) records hashes. The official suite is now pinned through the `realworld` Git submodule on `main` and this branch. The earlier cache-based preparation tooling was superseded by that integration.

```sh
nvm use
npm ci --ignore-scripts
git submodule update --init --recursive
npx playwright install chromium
npm run test:e2e:list
npm run test:e2e -- health.spec.ts \
  --grep 'app should load successfully|can navigate to login page|can navigate to register page'
```

The config extends the upstream base config and starts a separate dev server on port **5174**, preserving a user dev instance on 5173. It uses the normal public API by default. The selected smoke tests only load pages and perform reads.

For full integration, provide a specification-compatible backend and then run:

```sh
API_BASE=http://127.0.0.1:3000/api TEST_MODE=spa \
  npm run test:e2e \
  > docs/submission-evidence/official-full.log 2>&1
```

This is a future command, not a recorded successful run. Full tests create accounts/articles, modify settings, follow/favorite, and delete test content. Run against an authorized disposable backend. SPA mode retains the frontend capabilities; switching to fullstack would skip browser-specific coverage. The suite expects seeded cross-user data such as `johndoe`. Several mocks and its API health check hard-code `https://api.realworld.show/api`, so a local endpoint cannot make every unchanged test portable. Record those upstream limitations separately from implementation failures. Public demo execution needs explicit approval for its test writes; no real credentials are needed.

## Optional hosted demo

Build with `npm run build` and publish `dist` only after choosing and authorizing a host. The host must fall back to `index.html` for application routes. Use the normal API configuration, not a fixture-configured benchmark bundle. Verify direct article/profile routes and disposable-account workflows before adding a demo link. No deployment was made during preparation.

## Final handoff

Review the prepared form, feature-completeness declaration, and maintenance commitment. Then submit on CodebaseShow when authorized. The official introduction directs implementations there; a README-listing pull request is not the documented submission path.

Sources: [official introduction](https://docs.realworld.show/implementation-creation/introduction/), [expectations](https://docs.realworld.show/implementation-creation/expectations/), [frontend tests](https://docs.realworld.show/specifications/frontend/tests/), [official suite](https://github.com/realworld-apps/realworld/tree/ebbcdeb8d55b42a3a613c787560498b8ef10003f/specs/e2e).
