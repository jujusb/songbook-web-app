# 0018 — Setlist view and edit are separate pages

## Status

Accepted

## Date

2026-10-24

## Context

`/setlists/[setlistId]` used to render the inline `SetlistEditor` for admins/reviewers and the
read-only view for everyone else. Owners with the `setlist_creator` role only got a link to an
`/edit` route that did not exist, and editors could not see the setlist the way singers see it.

A first attempt redirected owners from the view to `/edit`. That hid the voice playlists and the
lyrics view from the people who build the setlist, so it was dropped.

## Decision

- `/setlists/[setlistId]` is the **read-only view for everyone**, owner and editors included
  (song order, lyrics, voice playlists, Present, PDF).
- Owners (with `canCreateSetlist`) and editors (reviewer/admin) get an **Edit** button on that page
  that opens `/setlists/[setlistId]/edit`.
- `/setlists/[setlistId]/edit` holds the `SetlistEditor` (title, date, description, songs) and the
  `SetlistShareControls` (public toggle, share link, slug). Anonymous users go to `/login`; anyone
  who is neither owner nor editor is sent back to the view page.
- Reference setlists (`sharedFrom`) are never editable, even by their "owner" (the subscriber).
- The read-only page lists only published songs to non-editors; the language filter was dropped
  to match the view's behaviour since ff85179 (it made the count show "0 songs").

## Consequences

- One mental model: the view page is what singers see; editing is an explicit action.
- Share controls moved off the view page; the share link is now managed from `/edit`.
- Save in the editor returns to the view page.

## Evidence

- `src/app/setlists/[setlistId]/page.tsx`
- `src/app/setlists/[setlistId]/edit/page.tsx`
- `docs/reference/routes.md`
