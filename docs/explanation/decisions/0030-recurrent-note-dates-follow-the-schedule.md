# 0030 — Recurrent note dates follow the note's schedule

## Status

Accepted; partly supersedes [0029](./0029-chords-publication-wrapping-and-current-version.md)
(the "Recurrent notes on any date" section). Refines [0025](./0025-recurrent-notes.md) §1.4.

## Date

2026-11-12

## Context

- ADR 0029 let a recurrent note be added to a setlist on any calendar date, with history dates
  only as suggestions. A weekly Sunday note could therefore be placed on a Tuesday, and a
  "first Sunday" note on the 15th.
- Recurrence was stored (`recurrent_type`, `recurrent_schedule`, `publishedDates`) but not used to
  decide which dates are valid. The note form also let users pick a schedule that did not fit the
  chosen type (for example `weekly` with `first`).
- The periodic behavior (`same` / `different_per_period`) controls what text a date shows. It does
  not control which dates exist.

## Decision

### One rule, shared by client and server

`src/lib/note-schedule.ts` is the single definition of allowed dates. It has no server imports, so
the setlist picker and the server validation use the same function.

| Recurrent type | Schedule | Allowed dates |
| --- | --- | --- |
| `daily` | ignored | every day |
| `weekly` | `sunday` … `saturday` | every date with that weekday |
| `monthly` | `first` | the first Sunday of the month |
| `monthly` | `first-second` | the first and second Sunday of the month |
| `monthly` | `last` | the last calendar day of the month (28–31) |
| `specific-dates` | ignored | only the note's `publishedDates` |

Periodic behavior is not part of the rule.

### Setlist picker

- The date picker in the setlist editor is the shared `RecurrentDateSelect` month calendar. Only
  allowed dates are clickable. The default is the next allowed date on or after today.
- Existing recurrent items in a setlist get the same calendar with `autoCorrect` off. A saved date
  that no longer matches the rule is kept as saved, and the calendar shows no selected day, so the
  editor can see it and pick a new date. Saved data is never moved silently.

### Note page and manual editor

- The date picker on the note page (`/notes/<id>`) and in the manual text editor
  (`/notes/<id>/manual`) is the shared `RecurrentDateSelect` month calendar. Only allowed dates are
  clickable; other days are shown greyed out and cannot be selected.
- The note page's date lives in `?date=`. Changing it updates the URL with `replaceState`, so the
  tab title follows it. Browser back/forward does not move the calendar, since `replaceState` does
  not trigger navigation.
- If the date in the URL or the stored date is not allowed, the component moves to the nearest
  allowed date (on or after the stored date, otherwise the last one before it).

### Dated setlists use the same calendar

- `DateCalendar` is the generic month grid: it takes an `isSelectable` predicate, marks days with
  saved data with a dot, and `RecurrentDateSelect` is built on it.
- Setlist page (`SetlistHistoryBrowser`): the version selector is a calendar only (no heading, no
  "New" button). Days with a saved version are clickable and open that version. The current
  setlist's day opens the current setlist. The calendar highlights the day of the version on screen.
- Setlist editor: the date field is a calendar where any day can be picked. Picking a day with a
  saved version opens that version for editing. Picking an empty day opens a new, empty setlist for
  that date (`?newDate=1&date=…&empty=1`). In new-date mode, picking an empty day clears the form
  to an empty setlist for that date.
- New dates start from an empty setlist: "Start from" defaults to "Empty setlist". Choosing the
  current setlist or a previous date copies it.
- Editing a version from another date shows that version's own date in the date field.

### Tab titles

Page titles include the date the page is about, taken from the page's data or URL:

| Page | Title |
| --- | --- |
| Setlist view | `Title - YYYY-MM-DD` (the `?version=` date when a version is open) |
| Setlist edit | `Title - Edit YYYY-MM-DD`, or `Title - New date YYYY-MM-DD` in new-date mode |
| Shared setlist | `Title - YYYY-MM-DD` |
| Note page | `Note - YYYY-MM-DD` from `?date=` |
| Note manual text | `Note - Manual text - YYYY-MM-DD` from `?date=` |

### Unsaved changes
- The editor compares its form with the state it opened with. Before leaving (back link, Cancel,
  New date, opening another day) it asks for confirmation. A `beforeunload` prompt covers tab close
  and reload. Saving skips both prompts.

### Server validation

- `POST /api/setlists` and `PUT /api/setlists` reject a recurrent-note item whose date the note does
  not allow, with a 400 error that names the date and the rule.
- Only new or changed items are checked (matched by item id, note id and date). A setlist saved
  before this rule can still be saved unchanged.
- Unknown note ids are not rejected here; rendering already handles missing notes.
- The same check runs when a historical version is edited.

### Note form

- The schedule options follow the recurrent type. Changing the type moves an incompatible schedule
  to the first valid option. The schedule is disabled for `daily` and `specific-dates`.

## Consequences

### Positive

- A setlist cannot contain a recurrent note on a date the note never applies to, from the UI or
  from a direct API call.
- The schedule a user picks is always one the rule understands.
- Client and server cannot disagree, because they share one module.

### Negative

- A note with no matching dates shows a calendar with no clickable days and a "No dates available"
  message.
- The one-year window is a UI limit. Setting a date further away requires the API, which accepts
  any date the rule allows.
- A `specific-dates` note with no published dates cannot be added to any setlist until dates are
  published.

### Carried forward

- Decide whether the picker window should follow the setlist's own date rather than today.

## Evidence

- `src/lib/note-schedule.ts` (rule, `selectableNoteDates`, `addDaysIso`, `describeNoteRecurrence`)
- `src/lib/setlist-items.ts` (`validateRecurrentNoteDates`)
- `src/app/api/setlists/route.ts` (create, update and version-edit paths)
- `src/components/RecurrentDateSelect.tsx` (note page and manual editor month calendar)
- `src/components/SetlistEditor.tsx` (add panel and item rows use `RecurrentDateSelect`), `src/components/NoteForm.tsx`
  (`SCHEDULES_BY_TYPE`)
- `src/lib/i18n/locales/{en,fr,es}.ts` (`setlist.dateNotAllowed`)
- `src/components/DateCalendar.tsx`, `src/components/SetlistHistoryBrowser.tsx`, `src/app/setlists/[setlistId]/edit/page.tsx`, `src/components/SetlistEditor.tsx` (`confirmLeave`, `handleDatePick`)
- Tests: `tests/components/SetlistEditor.dirty.test.tsx`, `tests/components/DateCalendar.test.tsx`, `tests/unit/lib/note-schedule.test.ts`, `tests/unit/lib/setlist-recurrent-dates.test.ts`, `tests/components/RecurrentDateSelect.test.tsx`
