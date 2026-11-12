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

- The date control in the setlist editor is a select that lists only allowed dates, from one year
  before to one year after today. The default is the next allowed date.
- Existing recurrent items in a setlist get the same select. A saved date that no longer matches
  the rule is shown in red so the editor can see it.

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

- A note with no matching dates in the window shows an empty, disabled date select, with no
  explanation yet.
- The one-year window is a UI limit. Setting a date further away requires the API, which accepts
  any date the rule allows.
- A `specific-dates` note with no published dates cannot be added to any setlist until dates are
  published.

### Carried forward

- Show an explanation when a note has no selectable dates.
- Decide whether the picker window should follow the setlist's own date rather than today.

## Evidence

- `src/lib/note-schedule.ts` (rule, `selectableNoteDates`, `addDaysIso`, `describeNoteRecurrence`)
- `src/lib/setlist-items.ts` (`validateRecurrentNoteDates`)
- `src/app/api/setlists/route.ts` (create, update and version-edit paths)
- `src/components/SetlistEditor.tsx` (`datesForNote`, date selects), `src/components/NoteForm.tsx`
  (`SCHEDULES_BY_TYPE`)
- `src/lib/i18n/locales/{en,fr,es}.ts` (`setlist.dateNotAllowed`)
- Tests: `tests/unit/lib/note-schedule.test.ts`, `tests/unit/lib/setlist-recurrent-dates.test.ts`
