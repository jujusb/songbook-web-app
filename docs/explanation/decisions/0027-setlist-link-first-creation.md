# 0027 — Setlist link-first creation and dated editing

## Status

Proposed

## Context

When a setlist is created today, the same form exposes title, description, date, media, songs, notes and links at once. The requested behaviour is to create only the link/shared entry first (public, shared token or private visibility) and to add content through the "New Date" history flow. Editors need a dated version before attaching songs and notes.

## Proposed flow

1. `/setlists/new` renders a minimal form with only title, description and visibility choice.
2. Saving creates a dated version under today's date (or a chosen date) and redirects to `/setlists/[setlistId]/edit?date=...`.
3. The full editor becomes the dated editing step and is used for subsequent entries.
4. Viewers can browse archived dates through `SetlistHistoryBrowser`.

## Proposed implementation

- `SetlistEditor` accepts `step: 'link' | 'dated'`. The `link` step hides song, note, link, image and media fields.
- Add `?date=` handling to `/setlists/[setlistId]/edit` to restore the matching version.
- `/history/new-date` already provides dated archives.
- Permission: link creation needs `canCreateSetlist`; dated editing uses `canEditSetlist`.

## Open questions

- Whether visibility is chosen at creation or derived from ownership.
- Whether "New Date" should copy content from the current version or start empty.
