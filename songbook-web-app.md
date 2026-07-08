# Songbook Web App — Architecture & Spec

A self-hosted, open-source, file-based songbook application: write songs with chords over lyrics, support many languages, export print-ready PDFs, project songs live, cross-reference texts, and compare translations side by side.

---

## 1. Guiding Principles

- **Files, not a database.** Every song lives as a human-readable Markdown/ChordPro file in a folder. Git-friendly, portable, diffable, no vendor lock-in.
- **UTF-8 everywhere.** No transliteration, no ASCII assumptions — Cyrillic, CJK, RTL scripts, combining diacritics must all render and print correctly.
- **Server-rendered where it matters.** PDF generation and projection view should not depend on client-side state that's hard to reproduce headlessly.
- **Self-hosted, single Docker Compose file, zero external services required.**

---

## 2. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router)** + TypeScript | File-based routing fits a file-based content model; API routes + server actions cover backend needs without a separate service |
| Chord parsing | **ChordSheetJS** | Mature, actively maintained JS library that parses ChordPro and renders chords-over-lyrics, handles transposition, and exports to HTML/plain text |
| Frontmatter | **gray-matter** | Parses YAML frontmatter (metadata) from each song file, body remains pure ChordPro |
| Markdown/text rendering (non-song prose, e.g. notes/references) | **remark/rehype** | For any freeform text blocks outside the ChordPro body |
| PDF generation | **Puppeteer (headless Chromium)**, printing a server-rendered HTML "print view" route | Gives pixel-perfect control over pagination, page breaks between songs, headers/footers, and correctly renders any UTF-8 script/font — far more reliable for i18n than JS PDF-drawing libraries |
| UI i18n (interface language, not song language) | **next-intl** or **i18next** | For the app's own UI strings (buttons, menus) |
| Styling | Tailwind CSS | Fast, consistent, easy print stylesheets via `@media print` |
| Editor | **CodeMirror 6** with a custom ChordPro syntax mode | Lightweight, good UTF-8/IME support, live preview pane alongside |
| Auth (optional) | Simple single-admin session cookie (bcrypt password in `.env`) or none for trusted-network deployments | Keeps it self-hostable without OAuth dependencies |
| Deployment | Docker + Docker Compose, volume-mounted `content/` folder | One command self-host; content folder can be a git repo itself |

---

## 3. Content Model & File Layout

Each song is a **folder**, not a single file, so it can hold multiple language versions plus shared metadata.

```
content/
  songs/
    amazing-grace/
      meta.yaml                 # shared, language-independent metadata
      en.cho                    # English lyrics+chords (ChordPro)
      es.cho                    # Spanish version
      fr.cho
    how-great-thou-art/
      meta.yaml
      en.cho
      pt.cho
  references/
    bible-kjv/                  # optional bundled reference corpora
      john-3.md
  config/
    languages.yaml              # enabled languages, display names, RTL flags
    site.yaml                   # app title, default language, PDF page size, etc.
```

### `meta.yaml` (per song, language-independent)
```yaml
id: amazing-grace
title: Amazing Grace
tags: [hymn, grace, traditional]
key: G
tempo: 72
ccli: "22025"
created: 2024-03-01
references:
  - type: bible
    label: "1 Timothy 1:15"
    target: bible-kjv/1-timothy-1
  - type: song
    label: "Related: My Chains Are Gone"
    target: my-chains-are-gone
```

### `en.cho` (per-language ChordPro body, with a small YAML header)
```
---
language: en
translator: null
status: final
---
{title: Amazing Grace}
{key: G}

{start_of_verse}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [Em]saved a [D]wretch like [G]me
{end_of_verse}
```

- The frontmatter block (parsed with gray-matter) carries per-translation metadata (translator, status: draft/review/final).
- The body below is **pure ChordPro**, parsed by ChordSheetJS — this keeps the format standard and portable to other ChordPro tools (OnSong, Chordify, etc.) if a user ever exports it out.

### `languages.yaml`
```yaml
languages:
  - code: en
    label: English
    rtl: false
  - code: es
    label: Español
    rtl: false
  - code: ar
    label: العربية
    rtl: true
default: en
```

---

## 4. Core Modules

### 4.1 Content Layer (`/lib/content`)
- `getSong(id)`, `listSongs()`, `getSongTranslations(id)`, `saveSong(id, lang, data)`.
- Reads/writes directly to the `content/songs` folder. Wraps `fs/promises` + `gray-matter` + `ChordSheetJS.ChordProParser`.
- Validates frontmatter with **Zod** schemas so malformed files fail loudly with a clear error rather than corrupting data.
- Optional: shell out to `git commit` on save, so every edit is versioned automatically (nice safety net for a file-based system).

### 4.2 Chord Rendering Engine
- Parse `.cho` body with `ChordSheetJS.ChordProParser` → `Song` object.
- Render with `ChordSheetJS.HtmlDivFormatter` (or a custom formatter) into chord-above-lyric HTML, wrapped in semantic `<div class="chord">/<div class="lyric">` pairs for CSS control.
- Transposition: `song.transpose(semitones)` is built into ChordSheetJS — expose a +/- key control in both the editor and the viewer.
- Font/monospace alignment: chords must stay aligned above the correct syllable even with wide Unicode scripts (CJK, Arabic) — use a flex/grid-per-line layout rather than relying on monospace character counting, since character width isn't uniform across scripts.

### 4.3 Editor (`/app/edit/[songId]/[lang]`)
- Split view: CodeMirror ChordPro editor (left) + live rendered preview (right), both scrollable and UTF-8 safe.
- Save button writes back to the file via a server action.
- "New translation" flow: pick a song, pick a language not yet present, scaffold a new `.cho` file with the same section structure as the source language (verse/chorus markers copied, lyrics blanked) to make translation easier.

### 4.4 Song Viewer (`/app/songs/[songId]`)
- Language switcher tab across the top.
- Renders chords-over-lyrics using the rendering engine.
- Shows the `references` list from `meta.yaml` as a sidebar (linked bible verses, related songs, etc.) — clicking opens the referenced text inline or navigates to it.

### 4.5 Projection View (`/app/present/[songId]`)
- Fullscreen, high-contrast, large-type route with no site chrome.
- Toggle: show/hide chords (typical for congregational display — chords for the band screen, lyrics-only for the audience screen).
- Keyboard nav: `←/→` or `Space` moves between verses/sections and between songs in a queued setlist.
- Optional **dual-window mode**: a "controller" browser tab drives a second `?display=audience` window (via `BroadcastChannel` API) — useful for a laptop + projector setup, common in worship-software use cases.
- Auto-fit font size to viewport so any language/script fills the screen without overflow.

### 4.6 Print / PDF Export (`/app/api/pdf`)
- A dedicated print-layout route (`/app/print/[lang]` or `/app/print/[songId]/[lang]`) renders the songbook as clean paginated HTML with `@media print` CSS: page breaks between songs, running header (song title), page numbers, table of contents generated from the song list.
- Server-side, **Puppeteer** loads that route headlessly and calls `page.pdf()` to produce the actual file — this guarantees the PDF matches what's rendered (fonts, RTL, chord alignment) rather than reimplementing layout in a PDF-drawing library.
- Two export modes:
  - **Single language, all songs** — the whole songbook in one language (the feature you asked for).
  - **Single song, all languages** — useful for translators to proof side by side.
- Font embedding: bundle a few open Unicode fonts (e.g. Noto Sans + Noto Sans Arabic/CJK) so PDFs render correctly regardless of the server's installed fonts.

### 4.7 Compare Page (`/app/compare/[songId]?langs=en,es`)
- Two (or more) language columns rendered side by side, each independently scrollable but with a "sync scroll by section" toggle that aligns matching verse/chorus blocks (matched by section label, e.g. `{start_of_verse}` markers, not line count — line count won't match across languages).
- Useful both for translation review and for bilingual congregational display.

### 4.8 Search & Index
- Simple in-memory index built at startup (or on file change, watched via `chokidar` in dev) over titles, tags, and lyrics across all languages — no external search service needed at this scale (hundreds to low thousands of songs).

---

## 5. Cross-Referencing Model

`references` in `meta.yaml` is deliberately generic (`type` + `label` + `target`) so it can point to:
- Another song in the library (`type: song`).
- An external text corpus bundled under `content/references/` (`type: bible`, `type: poem`, etc.) — these are just Markdown files, rendered read-only, no chords.
- A free-standing URL (`type: link`) for things you don't want to bundle.

This keeps the reference feature schema-light now, extensible later (e.g. liturgical calendar tags, thematic indexes) without a migration.

---

## 6. Repo / Folder Structure

```
songbook-app/
  app/
    songs/[songId]/page.tsx
    edit/[songId]/[lang]/page.tsx
    present/[songId]/page.tsx
    compare/[songId]/page.tsx
    print/[lang]/page.tsx
    api/
      songs/route.ts
      pdf/route.ts
  lib/
    content/           # file read/write, validation
    chordpro/           # parsing/rendering wrappers around ChordSheetJS
    pdf/                # puppeteer invocation
  components/
    ChordSheet.tsx
    LanguageSwitcher.tsx
    ReferencePanel.tsx
  content/               # the actual data — mountable as a volume / separate git repo
  config/
  docker-compose.yml
  Dockerfile
```

---

## 7. Deployment

```yaml
# docker-compose.yml (sketch)
services:
  songbook:
    build: .
    ports: ["3000:3000"]
    volumes:
      - ./content:/app/content   # persists & is editable outside the container too
    environment:
      - ADMIN_PASSWORD_HASH=...
```

Because content is just files on a mounted volume, backup = `rsync`/`git`, and migration to another host = copy the folder.

---

## 8. Suggested Build Phases

1. **Foundation** — content layer, Zod schemas, folder scaffolding, basic song list + viewer (single language, no chords styling yet).
2. **Chord rendering** — integrate ChordSheetJS, get chord-above-lyric display correct across scripts, add transposition.
3. **Editor** — CodeMirror + live preview + save.
4. **Multi-language** — language switcher, "new translation" scaffolding flow.
5. **Projection view** — fullscreen mode, chord toggle, keyboard nav, dual-window.
6. **Compare page** — side-by-side with section-aware sync scroll.
7. **PDF export** — print stylesheet route + Puppeteer pipeline, single-language songbook export first, then single-song multi-language export.
8. **References** — sidebar panel, bundled reference corpora support.
9. **Polish** — search, tags/setlists, optional git-commit-on-save, Docker packaging.

---

## 9. Open Questions to Settle Before Coding

- Single admin user, or multiple accounts with roles (editor vs. viewer)?
- Do you want a **setlist/service-planning** feature (ordering songs into a service for the projection view), or is projection always one song at a time?
- Should the reference corpora (e.g. a Bible translation) ship bundled, or be left for the user to add themselves for licensing reasons?
- Preferred PDF page size/margins (A4 vs Letter) as the default?

---

This spec should be enough to start scaffolding Phase 1. Let me know if you'd like me to adjust any part of the stack (e.g. swap Puppeteer for a different PDF approach if Chromium-in-Docker is a concern) before I start building.