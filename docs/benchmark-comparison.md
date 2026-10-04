# RealWorld benchmark comparison

Latest full measurement: 2026-10-05 (Asia/Seoul; raw run timestamp 2026-10-04T15:01:32.910Z). All five implementations were measured sequentially with the unchanged shared workload, machine, Node and Chromium versions. The measured Marionette application source matches [the final application commit](https://github.com/marionettejs/marionette-realworld-example-app/commit/48b910a2e2c496772d1409c19792a7ef0ce8121d). The manifest retains the original measurement identity; see [evidence provenance](metrics/README.md). Reference production builds are the same pinned artifacts used previously; they were not reinstalled or rebuilt. Prior results remain separate evidence and are not mixed into these medians.

## Executed results

All **100 measured timing samples**, 20 discarded warmups and 15 independent 100-cycle memory trials completed. Feed/article/comment content assertions passed with no page exceptions. Fresh Marionette checks passed: 99 development browser tests across Chromium/Firefox/WebKit, 19 production Chromium journeys, 3 unit tests, typecheck, repository lint and production build. These checks are not the upstream/live-backend acceptance suite.

Times are medians in milliseconds; initial JavaScript is actual requested payload recompressed at gzip level 9 in KiB. Mobile is a constrained desktop-browser profile, not a physical phone.

| Implementation | Initial JS gzip KiB | Desktop feed ms | Mobile feed ms | Article desktop / mobile ms | Return home desktop / mobile ms |
| -------------- | ------------------: | --------------: | -------------: | --------------------------: | ------------------------------: |
| Marionette     |                55.6 |             141 |            793 |                    73 / 175 |                        80 / 143 |
| Vue            |                49.3 |             141 |            832 |                    83 / 425 |                        77 / 140 |
| React FSD      |               111.1 |             408 |           1404 |                   335 / 458 |                       331 / 345 |
| Angular        |                98.4 |             176 |           1292 |                   101 / 637 |                        80 / 163 |
| SvelteKit      |                44.0 |             139 |            590 |                    79 / 158 |                        81 / 136 |

Feed readiness includes 20 previews, tags and two animation frames. SSR may show content before hydration; this is not universal time to interactive. Modules settle before subsequent clicks, which exclude hover prefetch and physical pointer/actionability overhead.

## Browser work during initial load

Chromium Performance script/main-thread task durations include module settling, not whole-process CPU accounting.

| Implementation | Desktop script ms | Mobile script ms | Desktop task ms | Mobile task ms |
| -------------- | ----------------: | ---------------: | --------------: | -------------: |
| Marionette     |               9.0 |             41.8 |            63.6 |          290.4 |
| Vue            |               8.4 |             38.9 |            55.0 |          249.6 |
| React FSD      |              29.9 |            130.8 |            86.6 |          372.5 |
| Angular        |              19.6 |             95.5 |            75.0 |          356.8 |
| SvelteKit      |               3.5 |             17.1 |            52.0 |          234.5 |

## Memory after repeated navigation

Three trials each: ten warmup cycles, then 100 measured cycles with two garbage collections at each checkpoint. Heap excludes native DOM memory, renderer RSS and SvelteKit server memory. Counters do not identify retained-object causes.

| Implementation | Baseline heap MiB | After 100 MiB | Growth KiB | Last 50 cycles growth KiB | DOM-node growth | Listener growth |
| -------------- | ----------------: | ------------: | ---------: | ------------------------: | --------------: | --------------: |
| Marionette     |              3.22 |          4.09 |        895 |                        53 |               0 |              13 |
| Vue            |              4.47 |          5.35 |        899 |                        51 |               0 |              13 |
| React FSD      |              4.19 |          5.31 |       1153 |                       108 |               0 |              13 |
| Angular        |              5.91 |          7.16 |       1282 |                       191 |               0 |              13 |
| SvelteKit      |              2.59 |          3.41 |        838 |                        54 |               0 |              13 |

Heap growth is not proof of a leak. Compare late growth and node/listener trends; these are bounded workload trials rather than a universal no-leaks claim.

## Total code and production output

Authored source includes tracked JS/TS/JSX/TSX/Vue/Svelte/HTML under `src`, excluding declarations and test/spec filenames. Comments remain in nonblank lines. Standalone styles, tests, configuration and dependencies are excluded; embedded component styles remain included. Formatting affects counts. Generated React API source is reported separately rather than silently counted as handwritten code.

| Implementation | Authored files | Nonblank source lines | Production JS files | Total JS raw KiB | Total JS gzip KiB |
| -------------- | -------------: | --------------------: | ------------------: | ---------------: | ----------------: |
| Marionette     |             29 |                 2,497 |                   1 |            187.5 |              55.6 |
| Vue            |             32 |                 1,913 |                  14 |            220.6 |              79.9 |
| React FSD      |             63 |                 2,633 |                  33 |            401.4 |             131.4 |
| Angular        |             53 |                 2,210 |                  22 |            407.1 |             130.0 |
| SvelteKit      |             41 |                 1,153 |                  36 |            124.7 |              54.7 |

React additionally generated 45 API/schema files with 2,753 physical lines. Its generated runtime contributes to bundles when used. SvelteKit also emits 61 server JavaScript files (398.9 KiB raw), excluded from browser output totals. This output count is not a complete deployment-size measurement including server dependencies.

## Method and comparison limits

- Machine: Apple M2 Pro, macOS ARM64, 16 GiB RAM; Node 24.19.0; Chromium 153.0.8010.12. One shared machine, not a dedicated benchmark host. App runs have fixed order, not randomized independent run blocks; timing outliers and other machine activity remain possible.
- Desktop viewport 1440×900, no CPU/network throttling. Constrained mobile viewport 390×844, 4× CPU slowdown, 80 ms client latency, 1.6 Mbit/s down and 0.75 Mbit/s up. No touch/device emulation claim.
- Same local read-only HTTP API, 40 ms server delay per GET, 20 summaries, two tags, 200 total articles, one article with 20 plain-text paragraphs, ten comments. The server honors query limits. Reference home limits are normalized from 10 to 20; API locations point at loopback. No live accounts, public-backend writes, or framework algorithm changes.
- Browser caches disabled, fresh contexts for timing samples, service workers blocked. External fonts/icons blocked; common local avatar. Browser request interception changes normal networking slightly and consistently. Shared theme revisions and exact markup still differ between examples.
- Four client SPAs are served by the same gzip static server. SvelteKit uses its production Vite preview with SSR. Its backend calls run locally without simulated client-network latency; that is an architectural topology difference, not a claim of equal client-only rendering. Server request CPU, memory, and production platform scaling are unmeasured.
- The React example renders article text in a paragraph; other implementations process Markdown. The fixture uses plain paragraphs to avoid a Markdown stress comparison, but semantic/presentation parity has not been fully audited. Current measurements do not establish acceptance compliance.
- Initial gzip totals cover scripts only. HTML, CSS, images, headers, external resources and full wire bytes are not included. All-route bundle totals are not initial download totals.
- The preserved reference builds originated from installs using npm with lifecycle scripts disabled and legacy peer resolution, then saved exact npm lock snapshots. These replace original Bun/Yarn/pnpm lock formats for this benchmark; no frozen-original-lock claim is made. React's documented API generation/conversion was run, with an AJV peer installed explicitly. Exact package versions, commits, patches and logs are retained.

## Interpretation and review

Marionette remains a competitive client-side implementation in this workload, with a modest single-bundle payload and clear feature ownership. The source review found no new concrete RC2 API/lifecycle defect.

These are selected implementations, not framework-kernel rankings. Small differences between sequential runs may reflect noise; the evidence includes ranges and raw samples. SvelteKit shifts work to its server, whose CPU/memory is unmeasured. Single-bundle delivery is an acceptable tradeoff at this size, not a demonstrated weakness. Agent-led development effort was not measured.

The requested dev server remained available on port 5173. No builds/tests ran during measurements, but possible user activity and fixed run order remain shared-machine limitations. Full live-backend acceptance remains unverified. Angular-specific branding, signup styling and footer policy were not copied.

## Evidence and reproduction

- [All fresh samples and memory checkpoints](metrics/full-final-run/results.json)
- [Summary](metrics/full-final-run/summary.json)
- [Marionette commit, source/harness and all production artifact hashes](metrics/full-final-run/build.json)
- [Pinned reference builds, versions and source counts](metrics/reference-run/builds.json)
- [RC2 source review](marionette-source-review.md), [visual review](visual-comparison.md), [loading review](loading-review.md)
- [Harness and reproduction commands](../benchmarks/realworld/README.md)

Run: `BENCH_APPS=marionette,vue,react,angular,svelte BENCH_OUT=docs/metrics/full-final-run node benchmarks/realworld/run.mjs`, after starting the shared fixture/static server and SvelteKit production preview. Build Marionette with `VITE_API_URL=http://127.0.0.1:5280/api`, pointing `MARIONETTE_DIST` at the fixed output. Benchmark servers were stopped afterward; the dev server remains available.

Earlier evidence directories are preserved. The reference installation/replay script has not been validated with a second clean install; this rerun measures the existing identified production artifacts.
