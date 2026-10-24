# 0020 — Setlist lyrics view and user preferences

## Status

Accepted

## Date

2026-10-24

## Context

Setlists needed a full-lyrics view for rehearsal and projection use cases. Users wanted:
- Expand all / collapse all lyrics
- Per-song transpose that persists
- Global display options (chords, repeats, notation, inline chords)
- Settings that remember across sessions

## Decision

Add a dedicated lyrics view mode to the setlist page with:

1. **Two display modes**: `all` (all songs expanded) and `list` (song list only, click to expand individual songs)
2. **Global options panel** (collapsible):
   - `showChords` — toggle chord visibility
   - `showRepeats` — toggle repeated section expansion
   - `chordNotation` — letters / solfege / roman / nashville
   - `inlineChords` — chords inline with lyrics vs separate rows
3. **Per-song transpose**: +/- semitone buttons with reset, stored per user per setlist per song
4. **User preferences persisted** to user YAML:
   - `setlistLyricsView` — default mode (`all` | `list`)
   - `inlineChords`, `showChords`, `showRepeats`, `chordNotation` — global defaults
   - `setlistTranspose` — `Record<setlistId, Record<songId, semitones>>`
5. **Server actions** to update preferences:
   - `updateSetlistLyricsViewAction(mode)`
   - `updateSetlistGlobalOptionsAction(options)`
   - `updateSetlistTransposeAction(setlistId, songId, semitones)`

The lyrics rendering reuses the existing `ChordSheet` / `transpose` logic from the song page.

## Consequences

### Positive

- Consistent with song-page chord display options
- Preferences follow the user across devices/browsers
- Per-setlist transpose means different keys for different contexts (e.g., rehearsal vs service)
- Read-only mode compatible: preferences are user-specific, no DB writes needed on public instance

### Negative

- User YAML grows with `setlistTranspose` entries (one per song per setlist)
- No bulk reset for transpose; must reset per song
- Global options affect all setlists; no per-setlist override for chords/notation/repeats

### Carried forward

- `UserPreferences` interface in `SetlistReadOnlyView`
- `User` schema extended with `setlistLyricsView`, `inlineChords`, `showChords`, `showRepeats`, `chordNotation`, `setlistTranspose`
- Server actions in `src/app/actions.ts`
- Global options panel in `SetlistReadOnlyView`

## Evidence

- `src/lib/auth/schemas.ts` — extended `UserSchema`
- `src/lib/auth/index.ts` — `updateUser` handles new fields
- `src/app/actions.ts` — three server actions for preferences
- `src/components/SetlistReadOnlyView.tsx` — lyrics view, global options, transpose controls
- `docs/how-to/setlist-lyrics-view.md` — user-facing documentation