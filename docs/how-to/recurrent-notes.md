1. Create or edit a setlist
2. Click the **Add note** button in the setlist editor
3. Browse available notes or use the search bar
4. Select a note from the list
5. A date select appears. It lists only the dates the note's schedule allows:
   - **daily** notes: every day
   - **weekly** notes: every date with the chosen weekday (for example every Sunday)
   - **monthly** notes: the first Sunday, the first and second Sundays, or the last day of the month
   - **specific-dates** notes: only the dates published for the note
6. Select the desired date. The rule is shown next to the select. Dates outside the window (one year back to one year ahead) are not offered.
7. The note will be added to the setlist with the selected date's version
8. Save the setlist

### Date rules

A recurrent note can only be placed on dates its schedule allows. The server rejects a setlist
that places a note on any other date, and the same rule applies to every recurrent item in the
setlist when it is saved. Setlists saved before this rule still open and save unless an item's
date is changed. See [ADR-0030](../explanation/decisions/0030-recurrent-note-dates-follow-the-schedule.md).

### Note Structure

Notes now support **multiple sections** that can include:
- **Manual text** (`md` field)
- **API-fetched text** (with `name`, `api_url`, `resultSection`, `authorization`)
- **Mixed content** (both API and manual, in a specific order)

When creating or editing a note:
- Each section is added as a separate entry
- Manual sections have the `md` field with the text content
- API sections have `name`, `api_url`, `resultSection`, and `authorization` fields
- The order of sections determines how the text appears in the note and in setlists
- Languages can be specified for each section or globally for the note

### Example: Creating a Note with Multiple API Sections

1. Go to **Notes** > **New note**
2. Enter:
   - **Title**: "Sunday Service"
   - **Language**: "en,es"
   - **Recurrent type**: weekly
   - **Recurrent schedule**: sunday
   - (The schedule list only offers values that fit the chosen type.)
   - **Sections**: Click "Add section" multiple times
     - **Section 1**: Type "api", Name "gospel-api", API URL "https://liturgical-api.example.com/gospel?lang=\${LANG}", Result Section "text"
     - **Section 2**: Type "manual", Markdown "Opening prayer: May your word be a lamp to our feet and a light for our path."
     - **Section 3**: Type "api", Name "psalm-api", API URL "https://psalm-api.example.com/psalm?lang=\${LANG}", Result Section "verse", Authorization "Bearer token123"
3. Save the note

The note will now have three sections that appear in order:
1. Gospel text fetched from the API
2. Manual opening prayer
3. Psalm text fetched from the API

When adding this note to a setlist, the date selector will show the assembled text from all sections for the selected date.

### Per-date manual text

Manual sections can either stay the same every period or change for each date:

1. Open the note editor and add a **Manual text** section.
2. Set its **Periodic behavior** to **Different text per period**.
3. Save the note.
4. From the note view, click **Edit manual text** (or open `/notes/<noteId>/manual`).
5. Pick the date, fill in the manual section text, and click **Save for this date**.

The date in the URL follows the date picker, so reloading or using back returns to the date you were editing.

#### Languages

The manual editor offers the note's **API applicable languages** (the multi-select in the note editor, restricted to the configured site languages). When no language is selected there, every configured language is offered. The note editor's manual text fields follow the same rule.

#### Where the text is stored

Each saved date is written as one markdown file per section and language:

```
data/notes/<noteId>/<date>/<lang>/<section>.md
```

- `<lang>` is the short code (`en`, `es`, `fr`, `pt`), matching the `.cho` convention.
- `<section>` is the section id (or `section-<index>` for sections without one).
- A section's text for the note's own language is also used as its default when no per-language file exists.
- Languages removed from a section have their files deleted on the next save.

Nothing is written under `data/notes/<noteId>/manual/` any more.

#### Read-only fallback and history

- Content saved before this change in `data/notes/<noteId>/manual/<date>.yaml` is still read when a date has no `.md` files yet, and older `manual/<date>/<timestamp>.yaml` versions are still listed and restorable. Nothing new is written there.
- New saves do not keep earlier versions. Re-saving a date overwrites its files; back up the `<date>/` folder first if you need the old text.

When a recurrent note is rendered in a setlist, manual sections use the content saved for that date (falling back to the section's base text), while API sections are fetched for that date.

## Back links

The note editor and the setlist editor have a **Back** link at the top that returns to the page they were opened from (the note, the notes list, the setlist, or the setlists list).

