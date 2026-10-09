# Link sheet-music PDFs to songs

Sheet music lives outside the content tree, in a "partitions" folder, and is linked into songs by
title. The app scans the folder, proposes matches, and stores the chosen PDFs on each song's
`meta.yaml`. The reader then shows an **Instrumental** panel with an embedded PDF per instrument.

## 1. Put the PDFs in the partitions folder

The container path is `/app/partitions`, backed by the host folder in `SONGBOOK_PARTITION_DIR`
(default `./data` in development, `/app/partitions` in the image). Organise it with one top-level
subfolder per instrument:

```
partitions/
  cuerdas/
    Amazing Grace - guitar.pdf
  vientos/
    Amazing Grace - flute.pdf
```

The top-level subfolder name becomes the instrument tab. A PDF is eligible only if its text title
contains the song's name (in any language); the match is a strict substring test.

## 2. Scan and match

1. Log in as **admin** and open **Admin → Partitions** (`/admin/partitions`).
2. Click **Scan Partitions**. The server walks the folder, decodes each PDF's basename, and matches
   it against song titles.
3. Review the proposed matches. Each match shows the song and the PDFs found for it.
4. Click **Apply** for individual songs, or **Apply All** to write every match at once.

Applying writes a `partitions` array into each song's `meta.yaml`:

```yaml
partitions:
  - instrument: cuerdas
    instrumentLabel: cuerdas
    file: cuerdas/Amazing Grace - guitar.pdf
    title: Amazing Grace - guitar
```

`file` is relative to the partitions root. `api/partitions/[...path]` refuses to serve anything
outside that root and refuses anything that is not a PDF.

## 3. What the reader shows

On a song page, an **Instrumental** panel appears when the song has partitions. It has one sub-tab
per instrument and embeds the PDF via `/api/partitions/...`. The endpoint is public — anyone who can
see the song can fetch its sheet music — and serves with a long cache lifetime.

You can also link to a specific one with `?parts=1` on the song page, which opens the panel
directly.

## Notes and gotchas

- **Matching is by title, not by folder.** A PDF whose filename does not contain the song's name in
  some language will not be proposed. Rename the file or apply the partition manually.
- **Instrument folders are the top level.** Nested folders inside an instrument folder are still
  served, but the tab is derived from the first path segment.
- **Partitions are metadata, not content.** They point at files in a separate volume, so moving a
  song folder does not move its sheet music. Keep the partitions volume backed up alongside
  `content/`.
- **The endpoint serves PDFs only.** Use `/api/music/...` for audio.

## See also

- [Content model reference](../reference/content-model.md)
- [Environment variables](../reference/environment-variables.md)
- [API endpoints](../reference/api-endpoints.md)
