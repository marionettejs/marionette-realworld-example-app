# Attribution and evidence handling

RealWorld baseline and agent modifications derive from `marionettejs/marionette-realworld-example-app` at `043fd2a3d8200c803fd005eeca5a8d9169304fff`, under the repository's root MIT LICENSE (Copyright (c) 2021 RealWorld). The snapshots are evaluation submissions and are not proposed upstream application fixes.

The composed lifecycle starter and original eleven-case acceptance suite derive from `marionettejs/marionette` at `0f2284ad4bbfe8c82ce82714471697a68c2acaeb`, `benchmarks/agent/tasks/composed-lifecycle-repair`, under the accompanying [MIT license](MARIONETTE-LICENSE.txt), Copyright (c) 2020 Paul Falgout. Two installed lint fixture sources also derive from that revision's `test/fixtures/consumer-lint`.

Requirements, additional hidden browser cases, replay packaging, operator diagnostics and this report were prepared for the evaluation. Source snapshots, handoffs and acceptance bytes are preserved; packaging scripts were adapted for public replay. The lint and restart observations are operator work performed after collection, explicitly unscored.

`manifest.json` hashes all released files other than itself. `sealed-original-hashes.json` binds the retained private originals; their raw archives are intentionally not released. Machine locations, private accounts, credentials and raw traces are excluded. Aggregate measurements and judgments are sanitized derivatives, not replacements for the original graded records. A4's exploratory scratch is omitted; its unchanged controller is included.
