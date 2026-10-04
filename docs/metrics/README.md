# Benchmark evidence

Use [full-final-run/results.json](full-final-run/results.json), [its summary](full-final-run/summary.json), and [its build manifest](full-final-run/build.json) for the final five-application comparison. The raw run timestamp is 2026-10-04T15:01:32.910Z, or 2026-10-05 00:01 Asia/Seoul. [The comparison report](../benchmark-comparison.md) explains the workload and limits.

## Application source identity

The following recorded snapshots have identical Git `src/` trees to the linked application commits. All 30 source hashes in the final manifest also match the final application commit. This establishes application source equivalence, not identical whole-repository trees or rebuilt production artifacts. Original measurement identities and artifact hashes remain in the manifests.

| Recorded snapshot                          | Matching application source                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `66bc371314b706d4f76c4065273da55f7c97eb84` | [`7ebb8da`](https://github.com/marionettejs/marionette-realworld-example-app/commit/7ebb8dabba32f144c5baf0fb45096b285ada66c8) |
| `ded911eb133856dfa5fc73e6fa25d43fd7dd1e72` | [`bbac29f`](https://github.com/marionettejs/marionette-realworld-example-app/commit/bbac29fa224293ddab7b131a6c8ca6f43c8d69b9) |
| `3e7ef93bc577a4afbd54849549059cb6a6fc21e4` | [`48b910a`](https://github.com/marionettejs/marionette-realworld-example-app/commit/48b910a2e2c496772d1409c19792a7ef0ce8121d) |

## Historical evidence

Other run directories preserve intermediate measurements or visual checks. Do not mix their samples with the final run or treat each directory as a separate development prompt or application commit.

- `source-metrics.json` records earlier Marionette source counts (18 files, 2,162 nonblank lines). The final counts are in `full-final-run/build.json` (29 authored TypeScript files, 2,497 nonblank lines); its source hashes also include CSS. Reference counts remain pinned to their recorded revisions.
- `browser-metrics.json`, `review-snapshot.json`, and the Marionette-only run directories describe earlier snapshots.
- Visual manifests using `baseCommit` and `sourcePatch` identify intermediate source through the base plus the saved patch; they do not claim final-source equivalence. The visual-final snapshot was not performance-benchmarked.
- Test logs describe executions at their recorded snapshots. Cross-browser executions are not distinct test scenarios, and local fixtures do not establish full upstream acceptance.

The evidence records implementation behavior and measured outputs. It does not establish original prompt wording, total development effort, or agent reliability.
