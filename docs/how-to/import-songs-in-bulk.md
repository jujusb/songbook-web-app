# Import a batch of songs

The bulk importer turns Word documents, PDFs, and plain-text files into ChordPro songs, extracts
metadata, and files them into albums. It is meant for seeding a library from an existing document
collection rather than for one-off entries.

## Before you start

- You need the `reviewer` or `admin` role, and the instance must be writable. The `/import` route
  404s in read-only mode and redirects anonymous users to `/login`.
- Prepare files with a sensible layout. The importer reads the document's structure (headings,
  tables for metadata, and lyrics text). It works best when each song's title is a heading and any
  metadata sits in a table.

## Import

1. Click **Songs** in the header, then **Bulk Import** (the button appears for editors on a
   writable instance).
2. Drop in your `.docx`, `.pdf`, and `.txt` files. Up to **200 files** per run; more than that
   fails with `TOO_MANY_FILES`.
3. Review the parsed preview. Each item shows its detected title, language, and body. You can fix
   what the parser got wrong before committing.
4. Choose a **target album**. The importer either uses an album you select or finds/creates one from
   the batch metadata.
5. Confirm. The server creates each song, then reports per-file outcomes.

## What the importer does

- `.docx` is read with `mammoth`, including tables, which are used for metadata and de-duplicated
  against the body.
- `.pdf` text is extracted with `pdfjs-dist`.
- `.txt` is read as-is.
- Common section words are normalized: an `intro` directive becomes `instrumental`, and known
  aliases for repeated sections are recognised. See
  [ChordPro subset](../reference/chordpro.md).

The result is ordinary song folders under `content/library/<album-id>/`. Nothing about an imported
song is special; edit it afterwards like any other.

## Outcomes and errors

The action returns a per-file outcome list, including files that were skipped and why (for example,
an empty body or an unsupported structure). A single bad file does not abort the batch; fix it and
re-import just that one.

## After importing

- Imported translations are `status: draft` and `published: false`. Review and publish them.
- Check the detected titles against `meta.yaml`; correct the `titles` map and the `{title:}`
  directive if needed.
- Assign songs to albums and set `key`, `tempo`, `ccli`, and references as needed.

## See also

- [Add a song by hand](./add-a-song.md)
- [Edit and publish a song](./edit-and-publish-a-song.md)
- [Server actions reference](../reference/server-actions.md) — `bulkImportSongsAction`
