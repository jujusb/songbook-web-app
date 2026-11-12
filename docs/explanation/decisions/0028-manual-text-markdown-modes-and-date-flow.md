# 0028 — Manual text as markdown, setlist modes and the dated-setlist flow

## Status

Accepted; in part supersedes [0024](./0024-setlist-modes-and-history.md) (default mode, fixed modes, legacy names) and the storage section of [0025](./0025-recurrent-notes.md) (manual history).

## Date

2026-11-11

## Context

Several behaviours had drifted from what users expected:

- Setlist modes ignored the purpose they were meant to serve: the public, guitarist and rehearsal views still followed personal display settings, and the mode list held overlapping names (`concert`, `instrumentalist`).
- Creating a new dated setlist and changing the date in the history dropdown did not reliably land on the dated version.
- Recurrent-note manual text was stored as YAML under `manual/`, with a snapshot history that was hard to follow, and its language list ignored the note's API applicable languages.

## Decision

### Setlist modes

- `default` (the initial mode for new setlists, `SETLIST_DEFAULT_MODE`) uses the user's profile display settings: chords, repeats, chord notation, inline chords, lyrics view, transposition, auto-scroll.
- `public` shows lyrics only, all expanded. No chords, no transposition controls, no display-options panel.
- `guitarist` always shows chords, with transposition controls. Display settings from the profile are ignored.
- `rehersal` (rehearsal) shows lyrics without chords in list view, plus voice selection and voice playlists.
- Legacy names are normalised by `normalizeSetlistMode` (`src/lib/setlist-modes.ts`): `concert` → `public`, `instrumentalist` → `guitarist`, `rehearsal` → `rehersal`. `SETLIST_MODES_ALLOWED` is normalised and de-duplicated.
- Transposition is the one per-setlist value shared across modes: a key is musical, so `guitarist` keeps the transposition the user saved in `default`, and saves changes back to the profile. Auto-scroll and display settings are not shared with the fixed modes.
- The view is keyed by mode, so switching modes remounts it and applies that mode's defaults.

### Dated setlists

- **New** (history browser) opens the editor in new-date mode. The new date's content can start from the current setlist, an empty setlist, or a previous date. The current setlist is always the most recent dated version: a later date becomes current, an older date does not change it. Creating a date whose folder name is already taken by different content (a timestamped label) does not move the current pointer.
- After creation, and after choosing a date in the history dropdown, the browser navigates to `?version=<label>`. The dropdown's value is derived from that URL, so it always matches the version on screen.

### Recurrent-note manual text

- Manual text is stored as `data/notes/<noteId>/<date>/<lang>/<section>.md`, one file per section and language, with the short language code as folder name.
- Saves and restores write only these files. Languages removed from a section are deleted. Nothing is written under `manual/`.
- Content already under `manual/*.yaml` is still read as a fallback and its old versions remain restorable; new saves create no history.
- The manual editor's languages are the note's API applicable languages (site-ordered, restricted to configured languages, empty = all). The note editor's manual text fields use the same list.
- The manual editor is keyed by the requested date, and the date picker keeps the URL's `date` parameter in sync.

## Consequences

### Positive

- Each mode does one thing, independent of personal settings (except default and the shared transposition).
- A dated setlist opens on the version that was just created or selected.
- Manual text can be read and edited outside the app as plain markdown files.
- Languages offered for manual text match what the API sections apply to.

### Negative

- Manual history is no longer recorded for new saves. Re-saving a date overwrites it; recovery means copying the `<date>/` folder beforehand.
- `toFileCode` in `src/lib/language-codes.ts` returns the app code for mapped languages (`en-US` rather than `en`) because of an operator-precedence bug. The notes code avoids it by deriving the short code itself. Fixing `toFileCode` would move existing `.cho` and note paths, so it is left as a separate decision.
- The mode selector's links do not keep the `version` parameter, so switching mode on an older version returns to the current setlist.

### Carried forward

- Decide whether manual history should return (for example as timestamped `.md` copies under `<date>/history/`).
- Remove the legacy `manual/*.yaml` read path once existing data has been migrated.

## Evidence

- `src/lib/setlist-modes.ts`, `src/lib/config.ts`, `src/components/SetlistReadOnlyView.tsx`, `src/components/SetlistModeSelector.tsx`
- `src/components/SetlistHistoryBrowser.tsx`, `src/components/SetlistEditor.tsx`, `src/app/setlists/[setlistId]/history/new-date/route.ts`
- `src/lib/notes.ts` (`noteApplicableLanguages`), `src/lib/content/notes.ts` (`writeManualMarkdown`, `readManualMarkdown`), `src/components/NoteManualEditor.tsx`, `src/components/NoteForm.tsx`
- Tests: `tests/unit/lib/setlist-modes.test.ts`, `tests/components/SetlistReadOnlyView.test.tsx`, `tests/unit/lib/note-applicable-languages.test.ts`, `tests/unit/lib/content/note-manual-markdown.test.ts`
