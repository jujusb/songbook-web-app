# Add a song by hand

You can add a song entirely from the UI, or by writing the files yourself. This guide covers the UI
flow, the `no-album` case, and the minimum a song needs.

## From the UI

1. Log in as a `reviewer` or `admin`. The header shows a **New Song** button.
2. Click it. The new-song form asks for a title and (optionally) an album, then creates the folder
   and a first translation.
3. You land in the editor. Write the ChordPro body, set the key, and **Save**.

Creating a song requires editing rights and a writable instance: the `/songs/new` route 404s in
read-only mode and redirects anonymous users to `/login`. See
[Roles and permissions](../reference/roles-and-permissions.md).

## What gets created

A song is a folder. Creating one writes:

```
content/library/<album-id>/<song-id>/
  meta.yaml
  <lang>.cho
```

with `meta.yaml`:

```yaml
id: my-song
title: My Song
titles:
  en: My Song
tags: []
references: []
audioFiles: []
partitions: []
```

and `<lang>.cho`:

```
---
language: en
translator: null
status: draft
published: false
---
{title: My Song}
```

The `song-id` is slugified from the title. It is also the folder name, and editing it later moves
the folder — see the "Change ID" action on the song page.

## Songs without an album

If you do not choose an album, the song goes into the reserved album `no-album`:

```
content/library/no-album/<song-id>/
```

Songs under `no-album` are not listed in any `album.yaml`, but they are otherwise normal songs.
Assign one to an album later with the **Change Album** action on the song page, or build an album
and add the song id to its `songs:` list.

## By hand

Create the folder and the two files above, then reload the app. To make the song appear to
anonymous visitors, set `published: true` in the `.cho` frontmatter (or publish it from the editor
as an admin), and add the song id to an album's `songs:` list if you want it on an album page.

The minimum a translation needs is a `language` key in the frontmatter and a non-empty body. The
minimum `meta.yaml` needs is `id` and `title`; the Zod schema fills in `tags`, `references`,
`audioFiles`, and `partitions` with empty arrays if they are absent.

## Tips

- Add a `{key: G}` directive and a `key: G` field in `meta.yaml` so the reader shows the key and
  transposition controls.
- Use `{start_of_verse: 1}` / `{end_of_verse}` and `{start_of_chorus}` / `{end_of_chorus}` so
  section highlighting, the presentation view, and repeat-chorus all work. See
  [ChordPro subset](../reference/chordpro.md).
- For many songs at once, use [Import a batch of songs](./import-songs-in-bulk.md) instead.

## See also

- [Content model reference](../reference/content-model.md)
- [Edit and publish a song](./edit-and-publish-a-song.md)
