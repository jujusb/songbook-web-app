# 0009 — Revisions are timestamped file snapshots

- **Status:** Accepted
- **Date:** 2026-10-05
- **Relevant code:** `src/lib/content/revisions.ts`,
  `.revisions/<lang>/<timestamp>.cho` under each song folder

## Context

The editor autosaves by writing the `.cho` file, and the founding spec (§4.1) flirted with
"git-commit-on-save" as a safety net. Git-on-save couples the app to a repo, forces commits to
carry the wrong content over time, and complicates a content folder that is often a plain mount.
The alternative — copy the file out before overwriting — is trivial with `fs/promises` and stores
nothing outside the song folder.

Revision management landed in `071b53e` (2026-10-05), with timestamp-format revisions in
`9cc428e` and publishable revisions in `a164b24`.

## Decision

- Every overwrite of an existing translation snapshots the current file first: save, revert, and
  delete each write to `.revisions/<lang>/<timestamp>.cho` via `saveRevision` before touching the
  live file.
- Revision operations distinguish **revert** (snapshot current, then restore the revision — a
  normal undo, leaves the public file visible during the swap) from **publish** (apply the revision
  without snapshotting, then mark the translation published with `publishedRevision`).
- Revisions are stored as copies; nothing diffs, compresses, or garbage-collects them.

## Consequences

**Positive**

- Restore is a file copy — no history backend, no git, no database. A song folder is self-contained.
- Because snapshots live beside the live file, the story survives backup/restore of the content
  folder wholesale.
- Revert doesn't touch the `published` flag's meaning: publish is the *explicit* step that both
  applies and re-publishes.

**Negative**

- Every autosave doubles the translation's file count, and the folder accumulates copies
  indefinitely. A long edit session can leave hundreds of snapshots.
- Copies duplicate the full text (with frontmatter) on each save; no delta, so history is
  redundant by definition.
- Revert-to-older then publish has subtly different semantics than publish-again; operators must
  know the difference to avoid unsnapshotting a good state.

**Carried forward**

- Git-on-save from the spec was never built and is explicitly not planned; `git` can still be run
  by hand over `content/` for a compact external history (the 
  [versioning guide](../../how-to/version-your-content.md) covers both).

## Evidence

- `071b53e` — revision management.
- `9cc428e` — timestamp revisions.
- `a164b24` — publishable revisions.
- `f1096a0` — revision tests (2026-10-09).
- How-to: [restore a revision](../../how-to/restore-a-revision.md).