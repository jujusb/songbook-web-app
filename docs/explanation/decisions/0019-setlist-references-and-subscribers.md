# 0019 — Setlist references and subscribers

## Status

Accepted

## Date

2026-10-24

## Context

Users wanted to "save" a shared setlist (accessed via a share link) to their personal library. The saved copy should stay in sync with the original — if the owner adds/removes/reorders songs, the subscriber should see those changes automatically.

## Decision

Introduce **reference setlists**: a lightweight setlist that points to an original via a `sharedFrom` field. Reference setlists:

- Are created via a server action (`saveSharedSetlistAction`) when a user clicks "Save to My Library" on a shared setlist page
- Have an empty `songs: []` array; songs are loaded from the original at render time
- Store `sharedFrom: { setlistId, shareToken, savedAt }` pointing to the original
- Are owned by the subscriber (their user ID), not the original owner
- Add the subscriber's user ID to the original's `subscribers` array
- Are deleted via `removeSavedSetlistAction`, which also removes the subscriber from the original's `subscribers`

The content layer (`getSetlist`, `listSetlists`) automatically merges reference data with the original:
- Original's mutable content (title, description, date, songs, voiceShares) overrides reference
- Reference's metadata (id, ownerId, sharedFrom, created) is preserved
- **Note**: `subscribers` is NOT merged — the reference has an empty array; subscriber list lives only on the original

Access control (`canViewSetlist`):
- Original owner: full access
- Subscriber: read-only view (cannot edit songs, order, title, description, date; cannot generate share links)
- Public via share token: read-only view

## Consequences

### Positive

- Automatic sync: changes to the original are instantly visible to all subscribers
- Lightweight: no duplication of song data
- Subscribers have their own per-setlist transpose and display preferences
- Works in read-only mode (public instance can show saved references)

### Negative

- Two setlist YAML files for one logical setlist
- Subscriber list only on original; reference's `subscribers` is always empty
- Cannot easily query "all setlists for user" including references without `listSetlists({ userId })`
- If original is deleted, references become orphaned (handled gracefully: `getSetlist` falls back to reference data)

### Carried forward

- Server actions for save/remove
- `sharedFrom` schema in `SetlistSchema`
- `subscribers` array on original setlist
- `isReference` flag computed in route handlers
- `canViewSetlist` checks `isSubscriber` flag

## Evidence

- `src/lib/content/schemas.ts` — `sharedFrom` and `subscribers` fields
- `src/lib/content/index.ts` — `getSetlist` merges reference with original; `listSetlists` includes references
- `src/app/actions.ts` — `saveSharedSetlistAction`, `removeSavedSetlistAction`
- `src/app/setlists/share/[token]/page.tsx` — "Save to My Library" button
- `src/app/setlists/[setlistId]/page.tsx` — reference badge, "View Original" link, "Remove from Library"
- `docs/how-to/setlist-lyrics-view.md` — documents the feature