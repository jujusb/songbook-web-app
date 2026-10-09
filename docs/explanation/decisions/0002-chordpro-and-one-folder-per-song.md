# 0002 — ChordPro songs in one-folder-per-song albums

- **Status:** Accepted
- **Date:** 2026-07-08 → 2026-09-19
- **Relevant code:** `src/lib/content/index.ts`, `src/lib/chordpro/*`, `content/library/<album>/<song>/`

## Context

The song directory had to solve three problems at once:

1. Storage must be portable and editable by hand (no database — see
   [ADR-0001](./0001-files-not-a-database.md)).
2. A song appears in several languages, and the original audio exists outside the repo.
3. Attendees render the same file differently — some read chord grids, some want note names, some
   play along.

The founding spec (§3) sketched a flat `content/songs/` layout with only the canonical language. The
actual implementation, from the first content-model commits, uses `content/library/<album>/<song>/`
with one folder per song and one `.cho` file per language. The layout change happened during the
audio/language work in the 2026-09-19 series (the `231-LIBRARY`-style album reworks) and finalized
with `1138128` (*"album management, no-album"*, 2026-09-24).

## Decision

- A song is a folder: `meta.yaml` for shared metadata, `<lang>.cho` per translation, `.revisions/`
  for snapshots, and (optionally) audio links and partition links in `meta.yaml`.
- The body is ChordPro with YAML frontmatter, parsed with `chordsheetjs` and rendered by a custom
  `VisualChordEditor`/`ChordSheet` pipeline (`src/lib/chordpro/*`). The custom renderer was added in
  `fb02185` (2026-09-19, *"visual chord rendering"*) for exact text alignment over chord positions.
- Section names follow a fixed vocabulary and are normalized on write: `verse`, `chorus`,
  `bridge`, `prechorus`, `intro`, `outro`, `instrumental`, `interlude`, `coda`, `tag` — with
  EN/ES/FR aliases and `intro` normalized to `instrumental`.

## Consequences

**Positive**

- Translation edits touch one file; shared metadata lives in `meta.yaml` and is never duplicated
  across `.cho` files.
- The ChordPro body is plain text, renderable by any ChordPro tool; ChordSheetJS needs no database
  and no service.
- The fixed section vocabulary lets the PDF/print layout align and lets voice sections be derived
  from section labels.

**Negative**

- Two parsers and renderers interpret the same ChordPro: `chordsheetjs` (metadata, transpose) and
  the hand-rolled visual renderer. They can drift — the renderer treats `intro` as
  `instrumental`, for instance.
- A section mislabeled with an alias is rewritten to the canonical label on save, which can
  surprise someone who wrote `[Intro]` and got `[Instrumental]` back.

**Carried forward**

- The flat-`content/songs/` sketch in the spec is stale; the code uses the album-folder layout.
- No automatic git commit on save was ever built; revision snapshots live next to the content
  (see [ADR-0009](./0009-revisions-are-snapshots.md)).

## Evidence

- `1138128` — albums gain `no-album` handling and the album-folder layout is enforced:
  `git show 1138128`.
- `fb02185` — visual chord rendering (custom renderer).
- `2bac1c0`, `7b3d645`, `b682e22` — section refactor, section aliases, `intro`→`instrumental`.
- `songbook-web-app.md` §3 — the superseded flat layout.