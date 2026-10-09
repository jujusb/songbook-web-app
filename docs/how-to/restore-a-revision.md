# Restore or publish an earlier revision

Every save of an existing translation snapshots the previous version into
`.revisions/<lang>/<timestamp>.cho`. The revisions sidebar lists those snapshots and lets you look
at one, roll the current translation back to it, or publish it directly.

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
content/library/<album>/<song>/
  es.cho
  .revisions/
    es/
      2026-10-05T14-22-01-123Z.cho
      2026-10-05T14-40-55-004Z.cho
```

Filenames are timestamps with characters that are awkward in filenames replaced, so they sort
lexically in time order. The API accepts an ISO timestamp for a revision and maps it to the
filename, so you never have to construct paths by hand. See
[API endpoints](../reference/api-endpoints.md).

> A revision is a snapshot of one translation, not of the whole song. Reverting the Spanish file
> leaves English untouched.

## Restoring without the UI

Because revisions are plain files, you can also restore one outside the app:

```bash
cp content/library/classic-hymns/amazing-grace/.revisions/es/<timestamp>.cho \
   content/library/classic-hymns/amazing-grace/es.cho
```

The next request reads the restored body. The `lastModified` in the copied frontmatter is the
snapshot's old value; the app will update it on the next save.

## See also

- [Tutorial 2](../tutorials/02-add-a-translation.md) — where revisions first appear
- [ADR-0009 — Revisions are snapshots](../explanation/decisions/0009-revisions-are-snapshots.md)
- [Server actions reference](../reference/server-actions.md)
