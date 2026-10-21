# 0017 — Old revisions are collected automatically

- **Status:** Accepted
- **Date:** 2026-10-21
- **Relevant code:** `src/lib/content/revisions.ts` (`collectRevisions`,
  `collectAllRevisions`, `getRevisionGCConfig`), `scripts/collect-revisions.mjs`

## Context

[ADR-0009](./0009-revisions-are-snapshots.md) made a snapshot of the previous translation on every
save. That is cheap per write and unbounded over time: a song edited a hundred times keeps a
hundred copies of the same file, forever, in the revision tree that
[ADR-0016](./0016-revisions-live-outside-the-library.md) moved out of the library.

The snapshots are not all worth keeping. Two limits cover almost every songbook:

- **A count limit.** The last few dozen snapshots are the ones an editor actually uses. Older
  ones are noise that hides the useful history in the sidebar.
- **An age limit.** A snapshot older than a season is archaeology, not history.

There is no database to garbage-collect: the collector works on the file tree, and the file names
already carry the timestamp, so the age of a snapshot is known without touching the file.

## Decision

- A snapshot is **collected** when it is older than `REVISIONS_MAX_AGE_DAYS` days, or when it
  falls outside the `REVISIONS_MAX_COUNT` newest snapshots of its song and language. The newest
  snapshots always win.
- Defaults: `REVISIONS_MAX_COUNT=50`, `REVISIONS_MAX_AGE_DAYS=90`. `0` means "keep everything" for
  either one, so setting both to `0` turns the collector off.
- The collector runs **after every save** that writes a snapshot, on that song and language only.
  It is a directory listing and a few unlinks, so it is cheap enough to do inline.
- A script, `npm run collect:revisions` (`scripts/collect-revisions.mjs`), walks the whole tree and
  applies the same rules — for the songs that are no longer being edited. `--dry` shows what it
  would delete.
- Files that are not snapshot names are never collected, and a failure to delete is ignored: the
  revision directory can be mounted read-only, and a failed collection must never fail a save.

## Consequences

**Positive**

- The revision tree stops growing without bound, without anybody having to remember to clean it.
- The limits are two environment variables, so an operator can tighten them for a busy songbook or
  turn the collector off entirely.
- The collector is idempotent and safe to run concurrently with the app: it only ever removes
  snapshots that are already beyond both limits.

**Negative**

- History is not permanent. A snapshot can be deleted while it is still the newest one, if the
  count limit is set to `0` and the age limit is short — the age limit wins.
- The published revision can be collected. `publishedRevision` in the frontmatter records a
  timestamp, and the file it names may be gone; nothing reads it back, but the reference can dangle.
- The count limit is per song *and* language, so a song with six languages can hold six times the
  limit.

**Carried forward**

- The script and the app implement the same rules twice, because the script cannot import the
  TypeScript module. The rules are small and stated in both places; a change to one has to be made
  to the other.
- Nothing collects a revision tree that is not mounted by the app — a leftover tree from a retired
  deployment has to be collected by hand.

## Evidence

- `src/lib/content/revisions.ts` — the limits, the collector, and the call from `saveRevision`.
- `scripts/collect-revisions.mjs` — the whole-tree sweep.
- `tests/unit/lib/content/revisions.test.ts` — the count limit, the age limit, the untouched
  foreign files, and the automatic collection on save.
- [ADR-0009](./0009-revisions-are-snapshots.md) — revisions are copies.
- [ADR-0016](./0016-revisions-live-outside-the-library.md) — where the revision tree lives.
