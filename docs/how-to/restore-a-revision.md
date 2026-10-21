# Restore or publish an earlier revision

Every save of an existing translation snapshots the previous version into
`revisions/<song-id>/<lang>/<timestamp>.cho` — a tree next to the content directory, outside the
library. The revisions sidebar lists those snapshots and lets you look at one, roll the current
translation back to it, or publish it directly.

## Open the revisions sidebar

In the editor toolbar, click **Revisions**. The sidebar lists the snapshots for the current
translation, newest first. For each one you can **View**, **Revert**, or **Publish**.

## Revert versus publish

Both apply the snapshot as the current translation. The difference is what they do with the
current version and the published flag:

| Action | Snapshots the current version first? | Sets `published`? |
| --- | --- | --- |
| **Revert** (`revertSongToRevisionAction`) | yes | no — only the body/frontmatter of the snapshot is applied |
| **Publish** (`publishRevisionAction`) | no | yes — sets `published: true` and records `publishedRevision` |

So **revert** is a normal undo: your current work is snapshotted before being replaced, so you can
revert the revert. **Publish** is "make this old version the live one", and it deliberately does
*not* snapshot the current version, because the revision is already stored.

Both actions require the `reviewer` or `admin` role, or a per-song permission. Both revalidate the
song, editor, list, and browse paths.

## The underlying files

```
revisions/<song-id>/
  es/
    2026-10-05T14-22-01-123Z.cho
    2026-10-05T14-40-55-004Z.cho
```

Filenames are timestamps with characters that are awkward in filenames replaced, so they sort
lexically in time order. The API accepts an ISO timestamp for a revision and maps it to the
filename, so you never have to construct paths by hand. See
[API endpoints](../reference/api-endpoints.md).

## How many snapshots are kept

Snapshots pile up — one per save — so a collector deletes the ones that are not worth keeping: a
snapshot is collected when it is older than `REVISIONS_MAX_AGE_DAYS` days (default 90), or when it
falls outside the `REVISIONS_MAX_COUNT` newest snapshots of its song and language (default 50).
The newest ones win, and the collector runs on every save.

To sweep the whole tree, for the songs that are no longer edited:

```bash
npm run collect:revisions -- --dry   # show what would go
npm run collect:revisions             # delete it
```

Set `REVISIONS_MAX_COUNT=0` or `REVISIONS_MAX_AGE_DAYS=0` to keep everything (or everything of
one kind). See
[ADR-0017](../explanation/decisions/0017-old-revisions-are-collected.md).

> A revision is a snapshot of one translation, not of the whole song. Reverting the Spanish file
> leaves English untouched.

## Restoring without the UI

Because revisions are plain files, you can also restore one outside the app:

```bash
cp revisions/amazing-grace/es/<timestamp>.cho \
   content/library/classic-hymns/amazing-grace/es.cho
```

The next request reads the restored body. The `lastModified` in the copied frontmatter is the
snapshot's old value; the app will update it on the next save.

## See also

- [Tutorial 2](../tutorials/02-add-a-translation.md) — where revisions first appear
- [ADR-0009 — Revisions are snapshots](../explanation/decisions/0009-revisions-are-snapshots.md)
- [ADR-0016 — Revisions live outside the library](../explanation/decisions/0016-revisions-live-outside-the-library.md)
- [Server actions reference](../reference/server-actions.md)
