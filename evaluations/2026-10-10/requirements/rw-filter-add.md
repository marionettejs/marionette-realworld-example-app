# Filter loaded articles

Add a text control labelled `Filter loaded articles` to each loaded article feed
(home and profile). Match titles by case-insensitive substring, trimming surrounding
query whitespace. Filtering is local to the current page: it must not fetch, change
the URL, pagination totals, or domain records. Empty query restores every loaded row.

Preserve the loaded list and row DOM identities across hide/reveal, input focus,
favorite actions, error/retry and navigation. Show a clear empty presentation when
nothing matches. Filtering survives a retained query refresh and applies to newly
loaded rows; stopping/leaving the feed resets the query. Existing loading, auth,
write coordination, navigation, drafts, and markup behavior must continue working.

Use the installed public 5.0.0 packages and guidance. Keep pinned dependencies and
existing tests intact. Add your own checks if useful. Finish with a brief handoff
describing behavior, files changed, commands run, and known limitations.
