# Extend the loaded-article filter

Starting from the supplied submission, extend `Filter loaded articles` to match
title, description, or any tag using the same trimmed, case-insensitive substring
rule. Preserve the original title matching, empty-query restore, list and row DOM
identity, input focus, retained refresh, favorites, failure/retry and navigation
behavior. This remains local to loaded articles and must not fetch or alter domain
data, routes or pagination totals.

Repair incomplete behavior in the supplied submission as necessary while preserving
working behavior. Use installed public 5.0.0 guidance, keep pinned dependencies and
existing tests intact, and report checks and limitations in a concise handoff.
