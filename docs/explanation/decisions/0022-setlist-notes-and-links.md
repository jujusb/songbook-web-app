# 0022 — Setlist notes, links and open-in-new-tab fallback

## Status

Accepted

## Date

2026-10-25

## Context

Setlists only held songs. Leaders also need free text between songs (announcements, readings) and references to external pages (sheets, slides). Many sites refuse to be embedded in an iframe (`X-Frame-Options`), and this cannot be detected reliably from the page.

## Decision

- `SetlistSchema.songs` becomes a list of items discriminated on `type`: `song`, `note` (Markdown) and `link` (http/https URL). Items without `type` are read as songs, so existing YAML keeps working and the field keeps its name.
- The API validates items with the schema (400 on failure). The max-songs limit counts songs only; total items are capped at twice that.
- Notes are rendered by a small in-house parser (`src/lib/markdown.ts`) that produces React elements, never HTML strings: raw HTML stays text and only http(s)/mailto links are made clickable. Notes can be written by any `setlist_creator` and shown on public share links, so this is safe by construction. A dependency such as `react-markdown` could replace it behind `MarkdownView`.
- Links are shown in a sandboxed lazy iframe (`allow-scripts allow-same-origin allow-popups allow-forms`, `referrerPolicy=no-referrer`).
- Every iframe in the app is wrapped in `EmbedFrame`, which always renders an "open in new tab" link (icon-only for compact players).
- Voice shares, presentation mode and Navidrome only consider song items. Print/PDF shows notes as rendered text and links as title + URL.

## Consequences

- Code reading `setlist.songs` must narrow with `isSongItem`.
- Embedded links may still be blank when the target forbids framing; the open-in-new-tab link is the fallback.
