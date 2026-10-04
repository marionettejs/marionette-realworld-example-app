# RealWorld implementation metrics — 2026-10-05

This is a descriptive comparison of selected implementations, not a framework benchmark or an agent reliability study.

## Source size

Counted all `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.svelte`, and `.html` files under `src/`, excluding declarations and filenames containing `.test.` or `.spec.`. Nonblank lines retain comments. Tests, dependencies, generated build output, configuration, and standalone CSS/SCSS are excluded. Embedded component styles remain included. No claim of equal feature coverage is made. SvelteKit includes server source; the other apps are client applications. Source formatting affects line counts; bytes and file counts are included for context.

| Implementation | Files | Physical lines | Nonblank lines | Source bytes |
| -------------- | ----: | -------------: | -------------: | -----------: |
| marionette     |    29 |          2,500 |          2,497 |       79,749 |
| vue            |    32 |          2,082 |          1,913 |       58,112 |
| react          |    63 |          3,063 |          2,633 |       97,560 |
| angular        |    53 |          2,443 |          2,210 |       78,870 |
| svelte         |    41 |          1,355 |          1,153 |       32,131 |

Reference sources were public shallow clones in `/tmp/realworld-metrics`. Revisions:

- marionette: [final application source `48b910a`](https://github.com/marionettejs/marionette-realworld-example-app/commit/48b910a2e2c496772d1409c19792a7ef0ce8121d)
- vue: `f7e48c8178602ce25d43293bc6f8ca51d84ae222`
- react: `969709a379b13935b4e1caae0ad8cad548e5879a`
- angular: `dd99ed2cf39c805d719f943c5d7061a5683d98a8`
- svelte: `df796708040f5200ec572b28ab7f88ecee5794dd`

Marionette counts reflect the final measured application source: 29 TypeScript files, or 30 source files including CSS. No application source was edited during measurement. The comparator counts retain their recorded reference revisions. React generated API/schema files are excluded.

Sources: [Vue](https://github.com/realworld-apps/vue-realworld-example-app), [React FSD](https://github.com/yurisldk/realworld-react-fsd), [Angular](https://github.com/realworld-apps/angular-realworld-example-app), [SvelteKit](https://github.com/sveltejs/realworld).

## Marionette production build

`npm run build` passed under Node 24.19.0 for the final measured snapshot. Vite reported 191.95 kB JavaScript, 57.46 kB gzip, across 44 transformed modules. This includes application code, Marionette and companions, Lit, Marked, and DOMPurify; it is not the framework's isolated size. The app emits one JS bundle, so editor and Markdown dependencies are shipped for initial feed loading too. Shared local CSS and external Google Fonts/Ionicons are additional resources.

## Recorded verification

The latest complete run records passing typecheck, lint, production build, 3 unit tests, 99 development browser executions (33 cases in each of Chromium, Firefox and WebKit), and 19 production Chromium journeys. See the [browser log](metrics/full-final-run/browser.log) and [production log](metrics/full-final-run/production.log). Browser tests use controlled HTTP responses; they do not establish live-backend authorization or full RealWorld acceptance.

## What these results support

Marionette source size is in the same broad range as the selected Vue, React FSD and Angular examples. SvelteKit is substantially smaller. These counts do not establish implementation quality, feature parity, performance ranking, or agent effort.

## Shared workloads

The [latest full benchmark comparison](benchmark-comparison.md) reruns all five production implementations with common data, API delays, desktop/mobile constraints and repeated-navigation memory checks. All 100 measured timing samples, 20 discarded warmups and 15 memory trials completed without page exceptions. Reference builds remain the pinned production artifacts; Marionette was rebuilt from the recorded snapshot.

Marionette initial JavaScript is 55.6 KiB gzip at harness level 9. Median feed readiness is 141 ms desktop and 793 ms constrained mobile; article navigation is 73/175 ms, return home 80/143 ms. Heap is 3.22 MiB initially and 4.09 MiB after 100 cycles, with flat DOM counts. These selected-implementation results are not universal framework rankings.

[Fresh raw evidence](metrics/full-final-run/results.json) and [snapshot hashes](metrics/full-final-run/build.json) are retained. Agent competitiveness needs matched development tasks measuring time, interventions and defects; it was not measured here.

[Evidence provenance](metrics/README.md) identifies the final run and historical snapshots. In particular, `source-metrics.json` contains earlier Marionette counts and is not the source of the final Marionette row above.
