# Implementation work log

This log records decisions, concise rationale, sources, changes, and observed verification. It is not a transcript of private internal reasoning.

## 2026-10-04 — inspection and contracts

- Inspected the checkout: clean Git status, base RealWorld README, license, code of conduct, logo, favicon, and ignore rules; no application or package configuration.
- Read the Marionette plugin skill. Installed release documentation will govern architecture and APIs.
- Confirmed npm publishes `marionette` and `@mnjs/data` at `5.0.0-rc.2`. An exploratory lookup for `@mnjs/template` returned 404; no dependency on that nonexistent package will be added.
- Scope: complete framework-neutral Conduit frontend, local implementation only. No credentials, publication, pushes, or deployments.
- Architecture and functional verification will be reported separately. Browser verification will use a deterministic local API fixture, without real accounts.
