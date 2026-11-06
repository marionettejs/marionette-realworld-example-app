# Marionette 5.0.0: bounded independent maintenance pilot

This report closes the bounded study in [Marionette #3751](https://github.com/marionettejs/marionette/issues/3751). It provides encouraging evidence for practical extension and maintenance, including a fresh-agent handoff, while retaining unsuccessful attempts and a demonstrated coverage gap. It makes no universal correctness, comparative superiority, or statistical success-rate claim.

The public evidence lives in Paul Falgout's evaluation fork. These are released evaluation snapshots, **not changes to the established example app**. The original sealed records and grades remain intact locally. This sanitized release excludes private accounts, credentials, machine paths and raw runner logs. A source hash manifest and hashes of retained originals provide provenance.

## Independent outcomes

The original four attempts are A1–A4. B1 was separately authorized and collected later from the original lifecycle starter; it is not a replacement silently folded into the original sample.

| Attempt | Task and context | Frozen outcome | Disposition |
| --- | --- | --- | --- |
| A1 | Add a local title filter to RealWorld; fresh context | Build, lint, 3 units, all 33 baseline browser cases and 3 withheld feature cases passed. Of 5 author cases, 2 passed and 3 failed (38/41 total). | Incomplete invocation; no handoff. Author tests used exact article-link names that did not match composite accessible names. |
| A2 | Same author extends the actual A1 submission to descriptions/tags | Protected-input gate rejected the rewritten inherited `tests/filtering.spec.ts` before behavior grading. | Change turn completed and wrote a handoff. Original upstream tests and dependencies were unchanged, but inherited author tests were protected too. |
| A3 | Fresh agent receives actual sealed A1 code and the same extension request | Build, lint, 3 units and **44/44 Chromium cases** passed (33 baseline + 7 author + 4 withheld). Separate fresh source architecture review PASS. | Overall pass within the frozen fixture and source-review scope; inherited tests preserved. |
| A4 | Repair the composed lifecycle controller; fresh context | Original solution unchanged; **7/11** frozen cases passed. | Incomplete invocation; only exploratory scratch added, no handoff. |
| B1 | Additional fresh lifecycle attempt from the original seed | **11/11** frozen cases passed, no skipped/cancelled cases; handoff delivered. Author's separate 15-scenario suite claimed pass. | No overall fully-correct claim. Architecture review was not performed; a separate post-hoc restart race was reproduced. |

A1 and A4 were interrupted by provider quota and remain incomplete. A2's native aggregate retained A1's earlier error; its current change turn completed. Usage is recorded incrementally rather than counting the inherited conversation twice. None of these distinctions changes the frozen outcomes.

A3 repaired article-link accessible names and ambiguous home links in application markup while extending filtering. It preserved the existing tests rather than adjusting their expectations. Its architecture review found local filtering through public CollectionView APIs, retained row/list identity, application-owned status and collection sources borrowed by views, and cancellation before teardown. Nonblocking limits: filtering runs twice per input; focus across a programmatic refresh while the input is focused was not verified. This is not a complete accessibility conformance assessment. The agent's own handoff is retained verbatim and is an author claim; independent grades in this report are authoritative.

A2 repaired locators and expanded description/tag cases but replaced an inherited middle-title substring assertion (`cle 2`). The operator's protected-test gate was byte based and prespecified. The public task said “keep existing tests intact”; future tasks should explicitly say that this includes inherited author tests and identify their protected hashes. This is a task/policy clarity improvement, not grounds for revising A2's grade.

## Separate supported-workflow finding

In B1, each `prepareStart` sets a shared `isStarting` boolean and clears it unconditionally in `finally`. A canceled retained restart A can settle after restart B begins, clearing B's pending gate. `refresh()` then starts a load and aborts B's latest load even though B remains pending. The public requirement says refresh must return false without loading while starting.

The deterministic sequence is: successful initial start → A waits for validation → B supersedes A and waits for load → A's noncooperative validation settles late → refresh while B remains pending. The observation was `refreshStartedLoad=true` and `latestLoadSignalAborted=true`; both should be false. See [the observation](observations/restart-race.json), [unchanged candidate](snapshots/B1/solution.mjs), and [reproducer](restart-race.mjs).

This is a defect in **generated controller code**, not a demonstrated Marionette framework defect or runner-policy artifact. The original eleven-case suite missed this overlap. The new probe is post-hoc, unscored, and was not sent back to an evaluated agent. No candidate repair, retry or retroactive grade change occurred. [Evaluation fork issue #2](https://github.com/paulfalgout/marionette-realworld-example-app/issues/2) tracks future acceptance coverage and controller repair separately.

## Provenance and collection policy

- RealWorld baseline: [`043fd2a3d8200c803fd005eeca5a8d9169304fff`](https://github.com/marionettejs/marionette-realworld-example-app/tree/043fd2a3d8200c803fd005eeca5a8d9169304fff).
- Matching framework and public documentation revision: [`0f2284ad4bbfe8c82ce82714471697a68c2acaeb`](https://github.com/marionettejs/marionette/tree/0f2284ad4bbfe8c82ce82714471697a68c2acaeb). Published `marionette`, `@mnjs/data`, `@mnjs/utils`, `@mnjs/radio`, `@mnjs/adapters` **5.0.0** tarball integrities matched the consumer lockfile; [package evidence](published-packages.json). Installed docs manifest had 39 pages and matching clean source provenance.
- Fixed model `gemini-3.8-flash-high`, high effort, official Antigravity CLI **1.3.3**; Node **24.19.0**, npm **11.17.0**. This evaluates the model with its runner and supplied public tooling.
- Disposable Ubuntu 24.04 arm64 VM, 2 CPUs, 4 GB memory, 16 GB disk. Agent and grader used separate OS identities. Agent had no sudo, host mount or forwarded host credentials. History, operator memories, references, withheld acceptance and grader outputs were inaccessible. Network allowed only the five approved model/avatar/public-doc transport hosts through a qualified proxy. Grading had a private network, protected home/system, read-only acceptance/dependencies/configuration and bounded process groups; composed grading used 60 seconds/2 GB.
- Public tasks/starter/tests plus installed official Marionette skill and seven read-only public-doc MCP tools were available. No interactive implementation hints, hidden-test feedback, fallback model or silent retries. A2 deliberately inherited its author's context; A3 was fresh and received actual A1 code, without a fabricated successful handoff or evaluator answers. A4 and B1 were fresh.
- Paul approved model/runner/permissions and an original maximum of four invocations, 30 minutes each, within 150 minutes, with zero purchased-credit spend. B1 had a separate one-invocation, 30-minute authorization under the same model and isolation. All five invocations are consumed; no campaign expansion is implied by publication. No credits were purchased. Native usage is not a monetary receipt, so monetary inference is unavailable. [Results](results.json) retain per-attempt wall time and native usage: original four total about 51m08s; B1 about 14m12s.

The historical draft policy and setup/debugging smokes were not the collection authorization. The actual approved operational envelopes and frozen artifacts were recorded before their respective invocations. All original outcomes, intervention records and unsuccessful attempts were retained. The publication does not expose the agent to withheld tests during collection; now that answers are released, these exact tasks are unsuitable for a new uncontaminated independent evaluation.

## State, lifecycle, lint and documentation evidence

| Area | Evidence and disposition |
| --- | --- |
| Consumer state ownership | RealWorld configures the native StateApi separately from data/DOM adapters. Form, session, comments and feed applications create owned status state; settings/auth/editor and comment views borrow it through documented `state`/`stateEvents`. Source inspection supports these boundaries. Arbitrary domain fields still require explicit application cleanup. |
| Runtime lifecycle and cancellation | A3 preserved all 33 baseline cases, including retained shell identity, one navigation listener/request after restart, synchronous stop/destroy cleanup, draft/error retry and cancellation against noncooperative work. A destroyed-row model-survival case is domain ownership evidence, not direct borrowed-StateApi proof. B1's eleven headless cases cover late loads/validation, obsolete errors, exact borrowed-state identity/survival, resource cycles and synchronous release. |
| Native StateApi contracts | A separate ordinary framework-source run passed **30/30** tests across state ownership, application state events and application state. These use native-provider source aliases, not an independent installed-consumer run. Owned cleanup/disposal ordering and borrowed-source survival are native contract evidence; they do not establish exact RealWorld event counts. |
| Installed consumer lint | Installed `marionette/eslint` with ESLint 10.12.0 caught all **4 invalid MN0040** private-member diagnostic examples and cleared **5 valid** examples. Baseline/A1/A2/A3 each had 29 clean TypeScript source files under the original consumer config. These are operator diagnostics, not naturally occurring agent error catches or broad false-positive statistics. Ordinary TypeScript/unused-symbol failures during agents' development were distinct. [Diagnostic evidence](observations/lint.json). |
| Installed docs | A1 read the skill and helper docs; A3 used the skill/helpers and three public MCP calls (`search_sections`, `get_symbol` for `CollectionView.setFilter`, `get_doc` for lists). B1 read installed Application/state/retained-restart guidance via eleven helper commands, recovering from an unknown heading by searching. No operator hints supplied missing answers. Matching docs were discovered and used, but did not prevent B1's userland readiness bug. One restricted scratch write was recovered inside its workspace; no causal link to the bug was established. |

Prior assisted baseline/reference/control runs are qualification evidence, **not prospective independent successes**: 33 baseline browser cases/3 units; 53 public corpus contracts; reference feature 36 and extension 37 browser cases; composed reference 11 cases with 9 discriminating variants; handoff packaging tamper controls. They justified bounded tasks and grader discrimination. Four original tasks give descriptive breadth; this small correlated pilot is not sufficient to estimate rates or compare frameworks.

Exact consumer StateApi callback counts and runtime unsubscribe-before-owned-disposal instrumentation remain deferred. Controlled construction/first-use/notification/disposal timing, heap retention/GC, live backend, Firefox/WebKit, other models/runners and broader environments remain unmeasured. Immediate disposer/resource counts and test durations are not performance or heap evidence. Release performance work remains outside this study. The generated restart race and test-policy clarity are recorded dispositions; no repeated failure here establishes a framework defect.

## Reproduce released evidence

Use Python 3.12+ and Node 24.19.0 (baseline minimum 24.15). Clone this PR branch with its Git history. From the clone root:

```sh
python3 evaluations/2026-10-10/replay.py A3 /tmp/realworld-a3-replay
cd /tmp/realworld-a3-replay
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium
npm run build
npm run lint
npm run test:unit
npm test -- --project=chromium --workers=2
```

The preparer verifies [manifest.json](manifest.json), exports the exact baseline into a **new** directory, overlays the released source/test delta, and supplies the original withheld cases. It performs no model calls and cannot attest a new run's independence. A1 is expected to retain three author browser failures. A2 replay may inspect behavior, but its original protected-input rejection remains final. Replaying A4 or B1 uses the baseline lockfile's same installed 5.0.0 packages rather than the collector's private local tarball paths; this packaging difference is explicit.

```sh
# From the clone root, with a different unused directory for each snapshot:
python3 evaluations/2026-10-10/replay.py B1 /tmp/lifecycle-b1-replay
cd /tmp/lifecycle-b1-replay
npm ci --ignore-scripts --no-audit --no-fund
node --test --test-timeout=45000 test/acceptance.test.mjs
# Return to the clone root; this probe intentionally exits 1 for sealed B1:
node evaluations/2026-10-10/restart-race.mjs /tmp/lifecycle-b1-replay
# This installed-rule diagnostic is expected to exit 0:
node evaluations/2026-10-10/lint-diagnostic.mjs /tmp/lifecycle-b1-replay
```

For native state evidence, use a separate clone of `marionettejs/marionette`, check out the pinned framework revision above, install its lockfile, then run:

```sh
npm test -- test/unit/state-owner.spec.js test/unit/application-state-events.spec.js test/unit/application-state.spec.js
```

The released agent handoffs and authored tests remain evidence even where their claims overstate the independently verified result. No output has been substituted with a reference solution. Evaluation snapshots are excluded from the repository's ordinary app lint command through one added ignore entry; replay uses the original baseline configuration. The app implementation, original licenses and upstream permissions remain intact. See [NOTICE.md](NOTICE.md) for copied-source attribution and [publication verification](publication-verification.json) for ordinary packaging checks distinct from prospective scores.
