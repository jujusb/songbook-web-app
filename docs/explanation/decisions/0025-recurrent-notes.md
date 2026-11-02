# 0025 — Recurrent notes

## Status

Accepted

## Date

2026-11-01

## Context

The songbook web app currently supports setlists as ordered lists of songs, but there is no built-in mechanism to:

- Manage recurrent notes that repeat across dates (e.g., weekly Gospel readings, monthly prayer intentions, seasonal reflections)
- Provide an editable UI with preview for note content
- Allow adding notes to setlists with date selection
- Search and filter notes by various criteria

As the app is used in diverse religious and community contexts, there is a need to:

- Create recurrent notes that can be associated with specific dates, weeks, or months
- Edit note content with a rich interface and preview the result
- Add recurrent notes to setlists, selecting which date's version to include
- Search and filter notes by title, language, recurrent type, and last modified date
- Persist note metadata and content as editable Markdown files

## Decision

We will implement a recurrent notes system based on the following principles and components:

### 1. Note Storage and Metadata

#### 1.1. Note Storage

Each note will be stored as a Markdown file (.md) in `content/notes/` with companion metadata in `meta.yaml`. This separation allows the content to be versioned independently of the metadata.

```
content/notes/
  gospel-sunday-a/
    meta.yaml
    text.md
  monthly-prayer/
    meta.yaml
    text.md
```

#### 1.2. Note Structure

Each note consists of a title, language, recurrent type information, and content sections. The content is stored in a structured JSON format within the meta.yaml file, supporting multiple API configurations and manual text.

#### 1.3. Note Metadata (meta.yaml)

Each note will be stored as a Markdown file (.md) in `content/notes/`, with metadata stored in `meta.yaml` using a structured JSON format for API configurations and content sections:

```json
{
    "name": "",
    "period": "weekly",
    "languages": "es",
    "sections": [
        {
            "type": "manual",
            "md": "Manual text here",
            "periodic_behavior": "same"
        },
        {
            "type": "api",
            "name": "gospel-api",
            "api_url": "https://liturgical-api.example.com/gospel?lang=\${LANG}",
            "resultSection": "daily-text",
            "authorization": null,
            "periodic_behavior": "same"
        }
    ]
}
```

#### 1.3.1. Weekly Behavior Options

Each section's `md` content (or API-fetched text) can have one of two behaviors:

- **`same`** (default): The text is the same for every week/occurrence. When a recurrent note is added to a setlist for any date, the `md` content is used as-is.
- **`different_per_period`**: The text can vary for each week/occurrence. When a recurrent note is added to a setlist for a specific date, users can provide different text for that date, or the system can fetch fresh text from the API.

#### 1.4. Recurrence Types

- **daily**: Same note every day (e.g., Gospel every day)
- **weekly**: Same note every week on the same day (e.g., Gospel every Sunday)
- **monthly**: Same note every month (e.g., Prayer intention for the month)
- **specific-dates**: Note applies to specific dates (e.g., "Christmas Gospel", "Easter Gospel")

#### 1.5. API Integration Flexibility

##### 1.5.1. Dashboard Configuration

Administrators can configure multiple API integrations via the dashboard:

- **Add API**: Enter a name, endpoint URL, languages, fetch frequency, and result retention
- **Enable/Disable**: Toggle APIs on/off
- **Priority**: If multiple APIs are configured, the system can use the first available result
- **Per-note assignment**: Each note can assign which API(s) to use

##### 1.5.2. API Fetching Process

When fetching a note:

1. Check the note's `sections` configuration
2. Try each API in order (or use a default if none specified)
3. If an API returns text, use it and record `last_fetched` and `result_kept: true`
4. If no API returns text, fall back to manual entry (if enabled)
5. Save the result in `meta.yaml`
6. Update search index

##### 1.5.3. Manual Entry

When no APIs are configured or all fail:

1. Administrator enters text manually via dashboard
2. Text is saved as .md file
3. `sections` is configured with `type: "manual"` and the `md` field
4. Search index is updated

##### 1.5.4. Mixed Content (API + Manual)

A note can have both API-fetched text and manually added text:

- The system stores both versions
- UI can toggle between "API text" and "Manual text"
- Both versions are preserved in the .md file with clear markers
- Useful when you want to API-fetch base text and add custom commentary

### 1.6. Search and Results

#### 1.6.1. Search Functionality

- Full-text search within note contents (.md files)
- Search by title, language, recurrent_type, sections.type
- Filter by recurrent_type (weekly, monthly, specific-dates)
- Filter by sections.type (manual, api)
- Filter by language
- Search within specific API-fetched text or manual text

#### 1.6.2. Results Saving

- Search results are persisted per note
- Each note has a `search_results` field in meta.yaml
- Results are tied to the note's ID and persist across app restarts
- Users can view previous search results for a note
- Maximum of `NOTES_SEARCH_MAX_RESULTS` (default 10) results are saved per note

### 1.7. Example: Weekly Note with Different Text Per Week

```json
{
    "name": "Sunday Gospel",
    "period": "weekly",
    "languages": "en",
    "sections": [
        {
            "type": "manual",
            "md": "Reflection for the week",
            "periodic_behavior": "different_per_period"
        }
    ]
}
```

### 1.8. Editing Weekly Text in the Interface

When `periodic_behavior` is set to `"different_per_period"`, the interface provides specific capabilities:

#### 1.8.1. Per-Week/Per-Occurrence Editing

- **Setlist date selection**: When a recurrent note with `periodic_behavior: "different_per_period"` is added to a setlist, the setlist editor shows an **Edit text** option for that specific date
- **Date-specific editor**: Clicking "Edit text" opens a Markdown editor pre-populated with the current text for that date
- **Save per date**: Saving the editor updates the text **only for that specific date** (the selected setlist date or the current week)
- **Preserve base text**: The base `md` content in the note metadata remains unchanged; edits are stored as date-specific overrides

#### 1.8.2. Dashboard Management

Administrators can manage per-week texts via the dashboard:

- **View all weeks**: List all saved text versions for the recurrent note, organized by date
- **Edit any week**: Open the editor for any previous week's saved text
- **Delete week-specific text**: Remove the date-specific override, reverting to the base `md` content
- **Bulk operations**: Apply the same text to multiple weeks at once

#### 1.8.3. API Integration for Dynamic Text

When `periodic_behavior` is `"different_per_period"` and the note has an API source configured:

- The system can automatically fetch fresh text from the API each week
- Users can also manually override the API text for specific weeks
- The interface shows: "Last fetched: [date]" and "Override: [manual text]"
- Users can toggle between "API text" and "Manual override" for each week

### 1.9. Example Workflow: Different Text Each Sunday

1. **Create the note**:
   ```json
   {
       "name": "Sunday Gospel",
       "period": "weekly",
       "languages": "en",
       "sections": [
           {
               "type": "manual",
               "md": "Reflection for the week",
               "periodic_behavior": "different_per_period"
           }
       ]
   }
   ```

2. **Week 1 (Nov 1)**: 
   - Setlist editor shows "Edit text" link
   - User enters: "Thanksgiving reflection text"
   - Text saved for Nov 1

3. **Week 2 (Nov 8)**: 
   - Setlist editor shows "Edit text" link
   - User enters: "Veterans Day reflection text"
   - Text saved for Nov 8 (Nov 1 text preserved)

4. **Week 3 (Nov 15)**:
   - Setlist editor shows "Edit text" link
   - User chooses "Use API text" (if API configured)
   - Or leaves as "Nov 8 text"

#### 1.9.1. Dashboard View

The dashboard shows a table of all weeks with saved text:

| Date | Text | Actions |
|------|------|---------|
| Nov 1, 2026 | Thanksgiving reflection | Edit | Delete |
| Nov 8, 2026 | Veterans Day reflection | Edit | Delete |
| Nov 15, 2026 | [no text saved] | Edit | Apply API text |

#### 1.9.2. Setlist Editor View

When viewing a setlist that includes a recurrent note with `periodic_behavior: "different_per_period"`:

- The note displays the text for the **current setlist date**
- An **Edit** button appears next to the note text
- Clicking Edit opens the Markdown editor pre-populated with the date-specific text
- Users can save changes, cancel, or revert to base text

### 1.10. Compatibility with API Integration

When `periodic_behavior` is `"different_per_period"` and the note has an API source:

- The system attempts to fetch fresh text from the API each week
- If the API call succeeds, users can choose to "Use API text" or keep their manual override
- If the API call fails, the manual override (if any) is used, or the base `md` content is shown
- A badge indicates: "Auto-fetched: [date]" or "Manual override: [date]"

### 1.11. Migration from "same" to "different_per_period"

Existing notes with `periodic_behavior: "same"` can be converted:

1. Open the note in the editor
2. Change `periodic_behavior` from `"same"` to `"different_per_period"`
3. The interface prompts: "This will allow per-week text edits. Existing setlist dates will keep their current text."
4. Click "Convert"
5. The note's `md` content becomes the default for all future weeks
6. New setlist dates can have custom text entered

### 1.11.1. Migration Example

```json
# Before conversion
{
    "name": "Sunday Gospel",
    "period": "weekly",
    "languages": "en",
    "sections": [
        {
            "type": "manual",
            "md": "The grace of our Lord Jesus Christ be with you all.",
            "periodic_behavior": "same"
        }
    ]
}
```

After conversion:

```json
{
    "name": "Sunday Gospel",
    "period": "weekly",
    "languages": "en",
    "sections": [
        {
            "type": "manual",
            "md": "The grace of our Lord Jesus Christ be with you all.",
            "periodic_behavior": "different_per_period"
        }
    ]
}
```

Now users can edit text per week via the setlist editor or dashboard.

### 1.12. Search and Filter by periodic_behavior

The note search interface includes a filter:

- **`periodic_behavior: same`**: Show notes where text is the same every week
- **`periodic_behavior: different_per_period`**: Show notes where text can vary per week
- **Combined with other filters**: Title, language, recurrent type, API source

This allows administrators to quickly find notes that support per-week customization vs. those with static text.


## Addendum — External API sections and viewing

### List-based sections

A note is now an ordered list of sections. Each section is either:
- `type: "manual"` with Markdown (`md`) and its own `periodic_behavior`.
- `type: "api"` representing an external API call (`api_url`, `resultSection`, `authorization`, `typeStyles`).

The note editing UI supports adding, removing, reordering and previewing these sections. The list page links to `/notes/<id>` (view mode) and exposes an **Edit** button to `/notes/<id>/edit`.

### External API placeholders

API URLs support placeholders:
- `${LANG}` / `$LANG` for the note language.
- `$DATE` / `${DATE}` with an optional format: `$DATE(YYYY-MM-DD)`, `${DATE:DD/MM/YYYY}`, etc.
- A default format can be supplied via `dateFormat`.

### Nested result selection

`resultSection` may traverse objects and arrays, e.g. `messes.lectures[0]` or `messes.lectures[]`.
- Use `[]` to select every item of an array.
- Each item's `type` field determines how it is displayed, using the `TYPE_STYLE_MAP` (defaulting to title/heading/subtitle). Custom per-section overrides can be provided through `typeStyles` (JSON in the editor).
- The preview pane shows the extracted text and the raw JSON for an example date.

### View mode

`/notes/<id>` lets the user pick an example date and renders the assembled note content for that date, combining manual sections and API-fetched sections.

### Field mapping for array/object API results

For API sections, the editor can derive the result keys from a preview and let the user configure:
- a single discriminator field (radio, only one) indicating which property contains the section type,
- a style for each field (`plain`, `bold`, `italic`, `h2`, `h3`, `quote`, `code`),
- the display order (move up/down).

Stored fields include `discriminator`, `fieldOrder` and `fieldStyles`. Extraction excludes the discriminator from the rendered fields by default, uses its value for type-based styling and applies `fieldStyles` per field.

### Sanitization

Text extracted from external APIs is sanitized by removing HTML tags (`<...>`) and common HTML entities before display or storage.

### Note management UI

- `/notes` redirects card clicks to `/notes/<id>` (view mode); each card has **Edit** and **Delete** buttons.
- `/notes/<id>` shows the note, a date selector, the assembled content for that date, and **Edit/Delete** actions.
- `/notes/<id>/edit` provides the full editor, per-section previews and field mapping.

### Nested array navigation and filtering

`resultSection` supports nested navigation:
- `[]` selects every item of an array.
- `[n]` selects a single index.
- `[key="value"]` filters an array to items matching `key == value`.
- Filters can be chained, e.g. `groups[].items[type="evangile"]`.

### Tabbed rendering

When an API result is an array of objects, each containing an array property of objects, the view renders one tab per top-level object. The tab title is derived from the first available string property (`title`, `titre`, `name`, `label`, `heading`, ...). Inside each tab, all items of the nested array are rendered. If there is only one top-level object, a single view is rendered instead of tabs.

### Generalization

Implementation avoids hard-coded mass/lecture terms and instead detects any array-of-objects whose elements each contain at least one array-of-objects property.
