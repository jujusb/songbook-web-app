1. Create or edit a setlist
2. Click the **Add note** button in the setlist editor
3. Browse available notes or use the search bar
4. Select a note from the list
5. A date selector will appear showing:
   - **Current**: Include the note as it exists today
   - **Specific date**: Select any date the note has been saved for
   - **Calendar**: Pick a date from the calendar interface
6. Select the desired date
7. The note will be added to the setlist with the selected date's version
8. Save the setlist

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
   - **Recurrent type**: daily
   - **Recurrent schedule**: sunday
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
5. Pick the date, fill in the manual section text (one textarea per configured language), and click **Save for this date**.

The recurrent note editor only manages the note structure and API sections. The manual editor manages the text that changes from one occurrence to the next. API sections are always fetched live for the selected date, so changing the API URL in the note editor affects every date immediately.

Each date is stored independently:

```
data/notes/<noteId>/manual/<date>.yaml
```

Every save that changes the text archives the previous content:

```
data/notes/<noteId>/manual/<date>/<timestamp>.yaml
```

Identical saves do not create duplicate versions. In the manual editor you can open an earlier version and restore it; restoring also archives the current content first, so nothing is lost.

When a recurrent note is rendered in a setlist, manual sections use the content saved for that date (falling back to the section's base text), while API sections are fetched for that date.
