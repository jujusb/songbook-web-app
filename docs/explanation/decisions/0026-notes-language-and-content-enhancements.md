# 0026 — Recurrent notes language, autoscrool and content enhancements

## Status

Accepted

## Date

2026-11-03

## Context

The recurrent notes feature shipped in 0025 used hard-coded language lists and single-language manual content. The public/read-only instance exposed a "New Note" button that led to a 404, and the URL/language handling did not accept both short and long codes.

## Decision

### Read-only instance

The `/notes/new` route keeps returning `notFound()` in read-only mode (consistent with `/songs/new`, `/albums/new` and `/artists/new`). `NotesList` now receives a `readOnly` prop and hides the "New Note", "Edit" and "Delete" controls when it is set.

### Language codes

- Application/config/display codes use the BCP 47 style set `en-US`, `es-ES`, `fr-FR`, `pt-BR`; existing content keeps its file codes (`en`, `es`, `fr`, `pt`).
- Filesystem paths, revisions and music sync translate through `src/lib/language-codes.ts` (`toFileCode` / `toAppCode`).
- `normalizeLanguageCode` accepts both short and long forms (`es` or `es-ES`), so URLs, query parameters, `/edit/[songId]/[lang]` and `/print/[lang]` accept either form. The proxy also normalises the locale cookie.
- Title lookups in `src/lib/content/index.ts` fall back to the file code when a meta.yaml still uses short keys, keeping stored data compatible without migration.

### Recurrent notes UI

- Language options on `/notes/new` and `/notes/[noteId]/edit` come from `getLanguagesConfig()` instead of a hard-coded list.
- The top-level single "Language" dropdown was replaced by an "API applicable languages" multi-select (with "All"/"Clear") that stores `languages` on each API section.
- `$LANG` keeps the long app code; `$LANG_SHORT` was added for the short/file code, and the helper text documents both.

### Manual sections

- Manual sections gained `mdByLanguage?: Record<string, string>`.
- The editor renders a text area per configured language; the saved `md` retains the primary-language fallback.
- `NoteView` renders the manual text for the active language (or its fallback), falling back to `section.md`.

### Autoscroll / language display

- `/notes/[noteId]` passes the user's `autoScrollSpeed` to `AutoScrollControl`.
- `NoteView` selects the API language from the top-bar locale when it is among the applicable languages, otherwise uses the note language.

## Implementation

- `src/lib/language-codes.ts`: alias-aware helpers.
- `src/components/NotesList.tsx`, `src/app/notes/page.tsx`: read-only awareness.
- `src/app/notes/new/page.tsx`, `src/app/notes/[noteId]/edit/page.tsx`, `src/components/NoteForm.tsx`: config-driven languages and multi-select.
- `src/lib/notes.ts`, `src/components/NoteView.tsx`, `src/app/notes/[noteId]/page.tsx`: per-language manual text and autoscroll initial speed.
- Proxy, i18n client and song/print/music/present/edit pages updated for language aliases.
