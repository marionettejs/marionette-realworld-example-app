# Handoff: Extended Loaded-Article Filter

## Overview

Extended the `Filter loaded articles` control in both home and profile feeds to match article title, description, or any tag in `tagList` using trimmed, case-insensitive substring matching.

## Behavior

- **Text Control Placement & Accessibility**: A text input labelled `Filter loaded articles` is rendered above `.feed-articles` in `FeedLayout` (used for both home and profile article feeds). The input uses `id="filter-loaded-articles"` and is wrapped by an associated `<label>`, supporting accessible queries (`getByLabel`, `getByRole('textbox')`) as well as placeholder matching.
- **Match Criteria**: Trims surrounding query whitespace and performs case-insensitive substring matching against:
  - `model.get("title")`
  - `model.get("description")`
  - any tag in `model.get("tagList")`
- **Local Filtering**: Filtering is strictly client-side to the current page. It does not trigger network requests (`fetch`/API calls), does not alter URL or browser history, does not modify pagination totals, and does not alter or remove domain records in `feed.articles`.
- **Empty Query Restoration**: Clearing the input or entering whitespace only (`""` or `"   "`) removes the filter and restores every loaded row.
- **DOM Identity & Focus Preservation**:
  - Marionette `CollectionView`'s `setFilter` and `removeFilter` methods detach excluded rows and re-attach matching rows without destroying their view or DOM instances.
  - Row DOM nodes and the list container node maintain reference equality (`prev === current`) across filter hide/reveal cycles.
  - Keystrokes in the filter control maintain focus without blur or re-rendering interruptions. If a focused row is detached, focus redirects to the filter input.
  - Favorite actions while filtered update row models and re-render the row's inner template while preserving row and list DOM identities and filter state.
  - Loading error and retry cycles preserve the loaded list and row elements.
- **Empty Presentation**: When no articles match the filter query, `ArticleList` automatically displays `EmptyFeed` (`.empty-feed-message` with `"No articles here... yet."`).
- **Retained Refresh & Life Cycle**:
  - Filtering survives retained query refreshes (pagination, tab switching on home or profile, and favorite reconciliation writes) and automatically applies to newly loaded rows.
  - The input's value is preserved across retained refreshes.
  - Leaving or stopping the feed (e.g. navigating to `/login`, `/register`, `/settings`, `/editor`, `/article/:slug`, or between home and profile) stops the feed application and completely resets the filter query. Returning to the feed renders an empty filter control displaying all loaded rows.

## Files Changed

- `src/features/feed/views.ts`:
  - Added filter markup (`.feed-filter`, label, input) to `FeedLayout` template.
  - Bound UI element (`filter: ".feed-filter-input"`) and `input` DOM event (`onFilterInput`).
  - Added `applyFilter`, `getFilterValue`, and `setFilterValue` methods.
  - Extended filtering predicate to match title, description, and tags (`tagList.some(...)`) with case-insensitive substring comparison and whitespace trimming.
  - Ensured `.feed-filter` toggles `hidden` alongside `.feed-articles` and `.feed-pages` during pending state.
- `src/features/feed/application.ts`:
  - Added `filterQuery` state and `filter(query)` method.
  - Added `filter` view event handler to sync filter state from `FeedLayout`.
  - Updated `onStart` to set the filter value and apply the filter to newly loaded articles upon start/restart.
  - Updated `onBeforeStop` and `onStop` to reset `filterQuery = ""` when the feed stops.
- `src/styles.css`:
  - Added layout styles for `.feed-filter` and `.feed-filter-label`.
- `tests/filtering.spec.ts`:
  - Added automated end-to-end test suite testing text control presence on home and profile, title/description/tag matching, absence of network/URL/pagination changes, empty query restoration, list and row DOM identity preservation, input focus, favorite integration, retained refresh persistence, and reset on feed exit.
- `HANDOFF.md`:
  - Documentation of implementation details, checks, and limitations.

## Commands Run

- `npm run typecheck`: Passed with 0 TypeScript errors.
- `npm run lint`: Passed with 0 ESLint warnings/errors.
- `npm run test:unit`: Passed all 3 unit tests.
- `EVAL_LOCAL_SERVER=1 npx playwright test tests/filtering.spec.ts --project=chromium`: Passed all 5 filtering tests.
- `EVAL_LOCAL_SERVER=1 npx playwright test --project=chromium`: Passed full Chromium test suite (38/38 tests).

## Known Limitations

- Filtering operates strictly on the articles currently loaded on the active page; it does not query across other unretrieved pagination pages.
- Query matching is based on case-insensitive substring matching; regular expressions, boolean operators (AND/OR/NOT), and fuzzy search are not supported.
