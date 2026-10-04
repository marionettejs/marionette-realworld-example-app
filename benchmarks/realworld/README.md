# RealWorld reference benchmarks

This harness measures selected production implementations, not isolated framework kernels. It uses public pinned source, a read-only local API, identical article data, and Chromium through this project's Playwright installation. Reference checkouts and dependencies live outside the application in `/tmp`.

## Reproduce

Use Node 24+ and install this project's dependencies. Preparation needs internet access, git, and npm. Ports 5280–5285 must be available. It installs dependencies with lifecycle scripts disabled and then explicitly runs the documented generators/builds.

```sh
node benchmarks/realworld/prepare.mjs
node benchmarks/realworld/server.mjs
```

Leave the server running. In a second terminal:

```sh
cd /tmp/realworld-reference-benchmarks/svelte
npm run preview -- --host 127.0.0.1 --port 5284 --strictPort
```

In a third terminal, from this project:

```sh
BENCH_OUT=docs/metrics/new-reference-run node benchmarks/realworld/run.mjs
```

Run only one benchmark process at a time. Pause other builds/browser tests for less noisy results. The runner takes several minutes. Stop the two servers afterward. `BENCH_ROOT` overrides the reference checkout directory in preparation/server scripts; the measured run used `/tmp/realworld-metrics`.

The runner defaults to Vue, React, Angular and SvelteKit. Set `BENCH_APPS=vue` to select a subset. Set a new `BENCH_OUT` path to preserve historical measurements: `results.json` in that directory is overwritten as progress is saved.

## Workloads and measurements

- Production anonymous home feed: 20 summaries, two tags, 200 total articles; article detail: 20 plain-text paragraphs and 10 comments. The API respects each request's limit and delays GET responses by 40 ms. Writes are rejected. No live credentials or public backend traffic.
- Desktop: 1440×900, no CPU/network throttling. Mobile profile: 390×844, 4× Chromium CPU slowdown, 80 ms client network latency, 1.6 Mbit/s download, 0.75 Mbit/s upload. This simulates constraints on a desktop machine; it is not an actual phone.
- Each timing profile has 12 fresh contexts: two discarded warmups and ten measured samples. Browser cache disabled, service workers blocked, remote fonts/icons blocked, local avatar shared.
- Feed content readiness is detected by 20 preview links plus rendered tags, followed by two animation frames. It includes automation detection overhead. For SSR this can precede hydration, so it is not a universal time-to-interactive measure. Initial modules settle before interaction tests.
- Article/home timing starts at a synthetic click event and ends after the required content and two animation frames. No hover prefetch or physical pointer/actionability overhead. This is route/content latency, not just render CPU time.
- Initial requested JS and all journey-requested JS are recorded as raw bytes and independently recompressed gzip level 9 estimates. These are script payload sizes, not complete wire transfer including HTML/CSS/images/headers. Total production JS across all routes is in `builds.json`.
- CDP `ScriptDuration`/`TaskDuration` provide initial browser script/main-thread task duration estimates. The historical JSON keys `scriptCpuMs`/`taskCpuMs` do not represent whole-process CPU accounting.
- Three independent memory trials per app: ten warmup home/article/home cycles, then 100 measured cycles. Collect garbage twice before samples at 0/25/50/75/100. Record V8 used heap and total DOM/listener/document counters, plus live element count. This is a bounded growth test, not proof that no leaks exist. SvelteKit server memory/CPU is excluded.

## Changes to reference apps

Only API addressing and home page size are adapted. Vue uses `VITE_API_URL`, React `API_URL`; Angular/SvelteKit have a hardcoded API literal replaced in the disposable checkout. Home limits are changed from 10 to 20. Saved patches list exact source changes. No framework internals, application algorithms, optimizations, or UI structure are altered.

These repositories use different lockfile formats. The measured installations used npm with `--ignore-scripts --legacy-peer-deps` and saved the resulting npm lockfiles, rather than asserting frozen compatibility with their Bun/Yarn/pnpm locks. React needs its existing Orval generator and Zod Mini conversion; AJV 8.17.1 is explicitly installed to satisfy the generator's missing peer under this install mode. The replay script uses saved npm locks. It has been syntax/lint checked; a full second clean installation/replay has not been executed.

## Measure Marionette

Build a snapshot with `VITE_API_URL=http://127.0.0.1:5280/api`. Point the static server at that build using `MARIONETTE_DIST=/absolute/path/to/dist`, then run:

```sh
BENCH_APPS=marionette BENCH_OUT=docs/metrics/marionette-run node benchmarks/realworld/run.mjs
```

The server exposes that snapshot on port 5285. Keep production source/build identity alongside results. The recorded Marionette run uses this shared workload; its separate evidence directory preserves the reference results.

Results and limitations: [reference report](../../docs/benchmark-comparison.md).
