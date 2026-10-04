# RealWorld visual comparison — 2026-10-04

The subsequent [loading-state review](loading-review.md) records the current feed loading/success/failure captures and verification. The profile/article/editor/navigation evidence below remains the preserved presentation snapshot; loading changes did not alter those templates or styles.

The final Marionette production snapshot corrects the four identified deviations: profile heading size, article-tag placement and theme classes, extra visible editor copy, and the custom mobile navbar wrapping rule. The shared RealWorld theme, fixtures, acceptance tests, features, and performance coordination are unchanged. References differ from each other; this is contract-based visual inspection, not a pixel-identity requirement or upstream acceptance certification.

## Contract decisions and final results

The authoritative [framework-neutral templates](https://github.com/realworld-apps/realworld/blob/ebbcdeb8d55b42a3a613c787560498b8ef10003f/docs/src/content/docs/specifications/frontend/templates.md) and unchanged [local theme](../public/styles.css) establish the markup and styling baseline. Reference sources were inspected in their pinned local checkouts, rather than inferred only from screenshots.

| Area                            | Evidence and change                                                                                                                                                                                                                                                                                                                                          | Verified result                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile                         | The canonical template and Vue, React, Angular, and Svelte profiles use `h4`. [ProfileHeader](../src/features/profile/views.ts) now uses that element. [Root navigation](../src/app/application.ts) selects the explicit focusable page heading, avoiding feed-card headings.                                                                                | A 24 px bold heading; profile header height fell from 277.5 to 259.9 px at both viewports. Profile navigation still focuses the username and sets the document title.                                 |
| Article tags                    | The canonical template places tags inside `.row.article-content > .col-md-12`. [ArticleBody](../src/features/article/views.ts) now follows that placement. Canonical/React/Angular/Svelte tags are plain pills; Vue puts the pill classes on tag links. The Vue variant preserves this app’s existing tag navigation while applying the neutral theme color. | Tags stay in the content column with the theme’s spacing and `#aaa` text. Clicking a tag still opens its feed. Markdown/render-change handling is unchanged.                                          |
| Editor                          | The canonical editor and Vue editor have no visible page heading or tag-entry help. [EditorView](../src/features/editor/view.ts) uses the existing `sr-only` utility for those accessible descriptions and the empty idle status region. Saving/error notices retain their existing behavior.                                                                | No added visible heading/help or empty status spacing. The accessible heading, tag-input description, navigation focus, and Tab progression to Article Title remain available.                        |
| Authenticated mobile navigation | The template and Vue header use the shared theme’s navbar layout. Removed this app’s additional mobile wrap/padding rules from [styles](../src/styles.css).                                                                                                                                                                                                  | Brand and navigation share a row at 390 px with normal and fallback resources. No document overflow; captured navbar height is 79.6 px. “New Article” can wrap within its own link, as space permits. |

Specific reference evidence: [Vue Profile](https://github.com/realworld-apps/vue-realworld-example-app/blob/f7e48c8178602ce25d43293bc6f8ca51d84ae222/src/views/Profile.vue), [Article](https://github.com/realworld-apps/vue-realworld-example-app/blob/f7e48c8178602ce25d43293bc6f8ca51d84ae222/src/views/Article.vue), [tag component](https://github.com/realworld-apps/vue-realworld-example-app/blob/f7e48c8178602ce25d43293bc6f8ca51d84ae222/src/components/VTag.vue), [editor](https://github.com/realworld-apps/vue-realworld-example-app/blob/f7e48c8178602ce25d43293bc6f8ca51d84ae222/src/views/ArticleEdit.vue), and [header](https://github.com/realworld-apps/vue-realworld-example-app/blob/f7e48c8178602ce25d43293bc6f8ca51d84ae222/src/components/TheHeader.vue). Cross-checked React FSD at `969709a379b13935b4e1caae0ad8cad548e5879a`, Angular at `dd99ed2cf39c805d719f943c5d7061a5683d98a8`, and Svelte at `df796708040f5200ec572b28ab7f88ecee5794dd`.

The installed Marionette/companion packages remain **5.0.0-rc.2** (documentation revision `f4243b8334cafe0bd1b06eba85d87e2310cb3618`). The packaged [accessibility and rendering guide](../node_modules/marionette/docs/guides/accessibility-rendering.md) supports owner-controlled focus after navigation. Feature Applications, Region/CollectionView ownership, cancellation, and concurrent preparation remain intact; the only Application change updates the page-heading selector.

## Executed checks and snapshot

[Source/build manifest](metrics/visual-final/build.json) identifies the final source by base commit plus patch and SHA-256 hashes, and records the exact fixture production build and unchanged harness hashes. This build includes the concurrent readiness and rendering changes from the performance task. [Build output](metrics/visual-final/build.log) records 44 transformed modules. The normal API build was restored after production tests.

Used the existing shared read-only API, disposable local authentication fixture, UTC dates, avatar, and Chromium at **1440×900** and **390×844**:

- Existing public-page harness: **20 Marionette captures**, covering home, article, profile, login, and registration with normal and blocked external resources. All succeeded, with no page exceptions or horizontal document overflow.
- Existing authenticated harness: **eight captures** of Marionette/Vue editor and settings, plus **one Marionette normal-font home check**. These new Vue screenshots are visual comparisons only; existing reference and performance results were not replaced.
- [Focused checks](metrics/visual-final/detail-check.mjs): **12 additional captures**, including profile focus/title, article tags and tag navigation, and editor/settings under normal and fallback resources. All assertions passed, including mobile brand/navigation row overlap, no document overflow, editor accessible description, and keyboard focus progression. No page exceptions.

That is **41 final captures**. Inspected the affected desktop/mobile profile, article-tag, and editor screenshots, plus mobile settings/navigation, against the earlier evidence and reference markup. This is visual inspection and geometry/assertion evidence, not an automated golden-image test or a claim that every captured pixel was reviewed. Normal-resource home loaded the used Lora, Source Sans Pro, and Ionicons faces without failed requests.

Correctness checks on the same source: types and lint passed; **93/93** development browser tests (31 each in Chromium, Firefox, WebKit); **17/17** production Chromium journeys; **3/3** unit checks; production builds passed. Tests were unchanged. Repository-wide formatting and `git diff --check` passed. No performance benchmarks were rerun; the [benchmark comparison](benchmark-comparison.md) still describes its measured, pre-presentation snapshot.

## Final screenshot evidence

- Profile: [desktop](metrics/visual-final/detail-desktop-profile.png), [mobile](metrics/visual-final/detail-mobile-profile.png)
- Article tags: [desktop](metrics/visual-final/detail-desktop-article-tags.png), [mobile](metrics/visual-final/detail-mobile-article-tags.png)
- Editor with normal resources: [desktop](metrics/visual-final/external-authenticated-desktop-editor.png), [mobile](metrics/visual-final/external-authenticated-mobile-editor.png)
- Editor with fallback resources: [Marionette mobile](metrics/visual-final/marionette-mobile-editor.png), [Vue mobile](metrics/visual-final/vue-mobile-editor.png)
- Mobile settings/navigation: [normal resources](metrics/visual-final/external-authenticated-mobile-settings.png), [fallback resources](metrics/visual-final/marionette-mobile-settings.png)
- Raw results: [normal public pages](metrics/visual-final/external-results.json), [fallback public pages](metrics/visual-final/results.json), [authenticated harness/font check](metrics/visual-final/auth-results.json), [focused geometry/assertions](metrics/visual-final/detail-results.json)

## Remaining differences and limits

- Short-page footer placement differs: Marionette retains `main { min-height: 65vh }`; Vue follows content, while React/Angular place it nearer the bottom. There is no common reference geometry to copy.
- Editor description and some settings controls retain different field sizes/textarea heights from the neutral template and selected references. Settings placeholders and vertical positions also differ. These were outside the four targeted corrections.
- Navigation labels/avatar and their internal line wrapping vary across references. Only the fixture username and the two recorded viewport widths were checked; arbitrary long usernames were not evaluated. No extra navigation styling or icons were introduced.
- References differ in Markdown paragraphs, sign-in actions, dates, labels, explanatory text, and footer presence. Full-page profile heights can differ with reference query limits. Normal-font captures depend on CDN availability.
- No formal assistive-technology audit, live backend validation, or upstream RealWorld acceptance run was performed. The focused accessibility checks cover DOM descriptions and browser keyboard focus only.

## Preserved baseline and reproduction

The earlier five-app review captured 50 normal-resource and 50 fallback public-page screenshots, eight authenticated screenshots, and one font check against Marionette `ded911eb133856dfa5fc73e6fa25d43fd7dd1e72`. Its [normal results](metrics/visual-run/external-results.json), [fallback results](metrics/visual-run/results.json), [authenticated results](metrics/visual-run/auth-results.json), [profile comparison](metrics/visual-run/compare-external-mobile-profile.png), and [editor screenshot](metrics/visual-run/marionette-mobile-editor.png) remain unchanged. Existing benchmark evidence and harness files were also verified byte-identical.

Use the existing [harness instructions](../benchmarks/realworld/README.md) and installed Node 24.19.0/Chromium 153.0.8010.12. The executed visual build was:

```sh
VITE_API_URL=http://127.0.0.1:5280/api npm run build -- --outDir /tmp/conduit-visual-final-dist-20261004
BENCH_ROOT=/tmp/realworld-metrics MARIONETTE_DIST=/tmp/conduit-visual-final-dist-20261004 node benchmarks/realworld/server.mjs
```

To preserve earlier artifacts, the unchanged visual scripts were invoked by absolute path from `/tmp/conduit-visual-final-capture` (their output directory is relative to the working directory):

```sh
VISUAL_APPS=marionette node /path/to/project/benchmarks/realworld/visual.mjs
VISUAL_APPS=marionette VISUAL_EXTERNAL=1 node /path/to/project/benchmarks/realworld/visual.mjs
node /path/to/project/benchmarks/realworld/visual-auth.mjs
```

Copied those captures into `docs/metrics/visual-final`; renamed the filtered fallback harness output `svelte-results.json` to `results.json` without changing its content. Run `node docs/metrics/visual-final/detail-check.mjs` from the project with the fixture server active to repeat the focused checks. No timing/memory benchmark scripts were invoked.
