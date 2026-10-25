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
- Notes are rendered with `react-markdown` via `MarkdownView`: no raw HTML (no `rehype-raw`), unsafe URL schemes stripped by the default URL transform, images disallowed, links open with `target="_blank" rel="noopener noreferrer"`. Notes can be written by any `setlist_creator` and shown on public share links.
- Links are allowlist-only: `SETLIST_LINK_EMBED_HOSTS` (comma-separated, `*.` wildcards; empty = no links can be added) and https only unless `SETLIST_LINK_ALLOW_HTTP=true`. The server rejects other hosts, credentials in URLs, private/loopback hosts and the site's own host, and re-checks at render time (a no-longer-allowed link shows only an open-in-new-tab link). Notes and links require a `setlist_creator`, `reviewer` or `admin` role.
- Links are shown in a sandboxed lazy iframe (`sandbox="allow-scripts allow-same-origin allow-popups"` (same-origin is needed for SPAs such as Navidrome; it is safe because only allowlisted hosts are framed and the site's own host is rejected at save and render time; no `allow-forms`), `allow=""`, `referrerPolicy=no-referrer`).
- `src/proxy.ts` sends a CSP (`frame-src` limited to self, blob:, Spotify, YouTube, Navidrome (API URL origins plus `SONGBOOK_NAVIDROME_FRAME_ORIGINS` for a differing public share host) and the allowlist; `frame-ancestors 'self'`; `object-src 'none'`; `base-uri 'self'`) and `nosniff`. There is no `script-src` yet (would need nonces).
- Every iframe in the app is wrapped in `EmbedFrame`, which always renders an "open in new tab" link (icon-only for compact players).
- Voice shares, presentation mode and Navidrome only consider song items. Print/PDF shows notes as rendered text and links as title + URL.

## Consequences

- Code reading `setlist.songs` must narrow with `isSongItem`.
- Embedded links may still be blank when the target forbids framing; the open-in-new-tab link is the fallback.
