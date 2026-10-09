# 0014 — The music importer was built, then removed

- **Status:** Superseded — the feature is gone
- **Date:** 2026-07-27 → 2026-09-24
- **Relevant code:** nothing remains; removed by `58f14d6`. The current import surface is
  `src/components/NewSongForm.tsx` (DOCX/TXT/PDF) and `src/app/import/` bulk import.

## Context

Early on, songs arrive as audio files before they arrive as ChordPro. The project built a music
importer to bridge that gap: scan a music folder (`MUSIC_DIR`), read audio metadata with
`music-metadata`, group files per song/language/voice, and let an editor link them to songs. This
landed with `b80ff6e` (SetlistVoiceLinks + music-metadata) and matured in `4dd5e54` (album
numbers, error handling), with a dedicated route `src/app/import/music/` and a 769-line client
component.

By 2026-09-24 Navidrome links had arrived as the audio story
([ADR-0011](./0011-two-navidrome-instances.md)), and the importer's scan-and-link view had no
callers.

## Decision

- Remove the music importer: delete `src/lib/music-importer.ts` (598 lines),
  `src/components/MusicImportClient.tsx` (769 lines), and `src/app/import/music/page.tsx`, strip
  the `actions.ts` code paths that depended on it, and remove the "import" UI translations.
  Commit: `58f14d6` (2026-09-24, *"Remove 'import' translations … delete music importer module"*).
- Keep everything the importer's *readers* needed: `src/lib/chordpro/{docx,pdf,txt,reference}-import.ts`
  survive as the document importers that feed `NewSongForm` and the bulk importer
  (`cbcd9a9`, 2026-09-29), and `src/lib/lyrics-sync.ts` survives for writing `.txt` lyrics into
  the music directory.

## Consequences

**Positive**

- One fewer feature surface to test and maintain; audio metadata handling no longer forces the
  `music-metadata` dependency into the bundle.
- The import story is now single and honest: import documents as ChordPro, link audio via Navidrome.

**Negative**

- Any workflow that genuinely imported from raw audio files lost its UI. The Navidrome voice
  playlists ([ADR-0011](./0011-two-navidrome-instances.md)) are the replacement, and they require
  the voice server + manual linking — a different operational model.
- `MUSIC_DIR` still exists for audio serving; operators who expected the importer's scan flow will
  find the env var but no importer behind it.

**Carried forward**

- The reversal is the reason the importer has no separate ADR: it *is* documented — as a removal.
  Feature removals keep their decisions visible, because the next person to suggest "just add a
  music import page" needs to see why the last one left.

## Evidence

- `b80ff6e` — music importer added (SetlistVoiceLinks).
- `4dd5e54` — music import enhancements.
- `58f14d6` — `git show 58f14d6` (removal; shows the deleted lines).
- `cbcd9a9` — bulk import (what `src/app/import/` is today).