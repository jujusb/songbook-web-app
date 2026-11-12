# 0029 — Chord publication, wrapped chord lines, current version and date rules

## Status

Accepted; extends [0028](./0028-manual-text-markdown-modes-and-date-flow.md).

## Date

2026-11-12

## Context

- Setlists showed chords for every song, including songs whose chords were not published for the language.
- On small screens a long chord line wrapped as two independent blocks: all chords stacked above all lyrics, which is hard to follow.
- New dated setlists left the current setlist unchanged even when they were the latest date, and a new date equal to the current date was only rejected after a server round trip.
- Recurrent notes could only be added for dates that already had a setlist version.
- Editors had no explicit way back to the page they came from.

## Decision

### Chords only when published

- A song's chords are shown in setlists (song page, setlist view, share page) only when `chordsPublished` is set for that song's language. Unpublished songs show lyrics only, in every mode.
- Roman and Nashville conversion follows the same rule.

### Wrapped chord lines

- `renderVisualChordSheet` has a `wrapSegments` option, enabled on the song page (`ChordSheet`) and the setlist view. Each line is split at its chords into `.vce-seg` blocks holding one chord over its lyric part.
- Each segment is an inline `<span class="vce-seg">` holding the chord (first in the markup, so reading order is chord, lyric, chord, lyric) and its lyric text. The chord is positioned above the text, so it takes no width: words fill each line and wrap at word boundaries, and a part moves to the next line only with its word.
- A split never falls inside a word: a chord between two non-space characters moves back to the start of that word.
- A chord placed on a space moves forward to the next word, so the space stays at the end of the previous segment and no segment starts with a gap.
- The same rule applies to the non-wrapped chord row (print, PDF, editor preview): a chord on a space is drawn over the next word's first letter.
- A chord wider than its word may overlap the text beside it, since it takes no width.
- The editor and the reference picker keep the previous markup, because the picker reads one lyric element per line.
- Setlist PDF and print output keep the previous layout.

### Current version

- The current setlist is always the most recent dated version. Creating a date later than the current one makes it current (the root's `date` pointer moves to it). An older date is stored in history only.
- A new date whose folder name is already taken by different content gets a timestamped label and does not become current.

### Date validation

- The new-date editor refuses a date equal to the current setlist's date before sending the request. The server keeps the same rule.

### Recurrent notes on any date

- Adding a recurrent note to a setlist accepts any calendar date. Dates from the setlist history are suggestions only. The server already accepted any `YYYY-MM-DD`.

### Back links

- The note editor and the setlist editor show a **Back** link to the page they were opened from. The setlist edit page's own back link was removed so there is one.

## Consequences

### Positive

- Unpublished chords are not shown to readers in setlists.
- Long chord lines stay readable on phones without splitting words.
- The current setlist always reflects the latest event.
- Users see the date error immediately and can add notes for any date.

### Negative

- A chord wider than its word may overlap the text beside it.
- A new date whose folder name is taken does not become current, which breaks the "latest date is current" rule in that case.
- The wrapped layout was checked from the markup and CSS only; it has not been verified in a browser on a phone.
- Setlist PDF and print still show the stacked layout.

### Carried forward

- Decide whether the wrapped layout should also apply to PDF and print.
- Decide how to make a same-day timestamped version current (it needs a different folder naming for the current pointer).

## Evidence

- `src/lib/chordpro/visual-render.ts` (`wrapSegments`, `splitSegments`), `src/components/ChordSheet.tsx`, `src/components/SetlistReadOnlyView.tsx`, `src/app/globals.css`
- `src/app/setlists/[setlistId]/page.tsx`, `src/app/setlists/share/[token]/page.tsx` (`chordsPublished`)
- `src/lib/content/index.ts` (`createSetlistDateVersion`), `src/components/SetlistEditor.tsx` (`currentDate`, back link, recurrent-note date)
- Tests: `tests/unit/lib/chordpro/wrap-segments.test.ts`, `tests/components/SetlistReadOnlyView.test.tsx`, `tests/components/ChordSheet.test.tsx`, `tests/unit/lib/content/setlist-history.test.ts`, `tests/integration/api/setlist-history.test.ts`
