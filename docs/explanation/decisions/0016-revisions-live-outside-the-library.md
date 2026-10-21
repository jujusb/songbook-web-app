# 0016 — Revisions live outside the library

- **Status:** Accepted
- **Date:** 2026-10-21
- **Relevant code:** `src/lib/content/revisions.ts`, `src/lib/content/paths.ts`,
  `scripts/migrate-revisions.mjs`, `revisions/<song-id>/<lang>/<timestamp>.cho`

## Context

[ADR-0009](./0009-revisions-are-snapshots.md) decided *that* revisions are timestamped copies of a
translation. It did not decide where they live — the first implementation put them next to the file
they were a snapshot of, in `content/library/<album>/<song>/.revisions/<lang>/`.

That layout had three problems.

1. **The song folder stopped being a song.** A folder that mixes live content and its history has
   to be filtered everywhere it is read: `getSongTranslations` ignores anything that is not a
   `.cho` file, the backfill script skips `.revisions` by name, and any future "walk the library"
   code has to know the exception.
2. **Renames and moves had two answers.** Moving a song to another album physically moved its
   snapshots with it; renaming a song did the same. Every one of those operations carried history
   along by accident of the folder layout, not by decision.
3. **The content mount grew a moving part.** The songbook content directory is often a plain bind
   mount of someone else's songbook. A folder of hundreds of snapshots per song sits inside the
   thing people sync, back up, and hand to other people.

The app already assumes a song id is unique across the whole library — `findSongPath` scans the
albums for it, and the URL of a song is `/songs/<id>`. Keying the history by song id therefore
matches the model the app already has.

## Decision

- Revisions live in their own tree, **next to the content directory and outside the library**:

  ```
  content/library/<album>/<song>/<lang>.cho    # the live translation
  revisions/<song-id>/<lang>/<timestamp>.cho     # its snapshots
  ```

  The root is `getRevisionsRoot()`: `process.env.REVISIONS_DIR` when set, otherwise
  `<working directory>/revisions`. In the Docker image that is `/app/revisions`, bind-mounted from
  `SONGBOOK_REVISIONS_DIR`.

- Snapshots are keyed by **song id**, not by album. Moving a song between albums, renaming an
  album, and re-ordering albums never touch the revision tree. Renaming a *song* renames its
  folder in the revision tree, so the history follows the song.

- A song folder now holds only live content: `meta.yaml` and the `<lang>.cho` files.

- The old location is migrated in two ways. `scripts/migrate-revisions.mjs`
  (`npm run migrate:revisions`) moves everything in one pass, and the app migrates lazily: the
  first time a song's revisions are read, a leftover `<song>/.revisions/` folder is moved into the
  revision tree and removed. Neither overwrites an existing snapshot; a collision keeps both, with
  a `-1` suffix on the newer file.

## Consequences

**Positive**

- A song folder is just the song. No code has to filter history out of it.
- Album operations are cheap and safe: a song can be moved between albums without touching a
  single snapshot.
- The content directory and the revision directory can be backed up, synced, or mounted
  independently. A public read-only instance can mount the revisions it needs and nothing else.
- The revision tree is browsable on its own: one folder per song, one per language.

**Negative**

- Two folders to back up instead of one. `rsync content/ newhost:` no longer brings the history
  along; the revision tree is a second copy.
- The revision tree is keyed by song id, so two songs with the same id in different albums would
  share it. The app already treats song ids as globally unique, so this only matters for a
  content tree that violates that assumption.
- The migration has to happen somewhere. The lazy fallback keeps it from being a hard
  requirement, but an operator who never runs the script keeps paying for the old layout until
  the app migrates it for them.

**Carried forward**

- Nothing garbage-collects snapshots. A long editing session still leaves hundreds of files; see
  ADR-0009.

## Evidence

- `src/lib/content/revisions.ts` — the revision tree, the file-name format, the lazy migration.
- `src/lib/content/paths.ts` — the path helpers shared by the content and revision modules.
- `scripts/migrate-revisions.mjs` — the one-pass migration.
- `tests/unit/lib/content/revisions.test.ts` — location, rename, migration, and path-traversal
  tests.
- [ADR-0009](./0009-revisions-are-snapshots.md) — the decision that revisions are copies.
