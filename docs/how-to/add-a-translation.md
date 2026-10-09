# Add or remove a translation

A translation is one `<lang>.cho` file inside a song folder. Adding one scaffolds an empty ChordPro
file; removing one deletes it, provided at least one translation remains.

## Add a translation

1. Open the song in the editor (`/edit/<song-id>/<lang>`), as a `reviewer` or `admin`.
2. In the language switcher at the top, choose **add translation** and pick a language that is not
   present.
3. The editor switches to the new file, scaffolded as:

```
---
language: es
translator: null
status: draft
published: false
---
{title: <title for that language, or the canonical title>}
```

4. Write the translated lyrics and chords, then **Save**.

Adding a translation never copies the source lyrics. The original design spec suggested copying the
section structure with blanked lyrics; the implementation does not do that, so start from an empty
body. See [Content model reference](../reference/content-model.md) for the exact scaffold.

The available languages come from configuration, not from a file. Add the code to `LANGUAGES`
(`SONGBOOK_LANGUAGES` in Compose) before you can create a translation for it. See
[Environment variables](../reference/environment-variables.md).

## Translated titles

Set the translated title in the editor's title field. That writes a `titles.<lang>` entry into the
song's `meta.yaml`, not into the `.cho` file, and the reader uses it for the language tab and the
page title. The `{title: ...}` directive inside the `.cho` body is separate and is what a ChordPro
renderer displays if you export the file.

## Remove a translation

In the language switcher, use the remove control on the tab you want to delete. Removing a
translation:

- writes a revision snapshot of it, then deletes the file,
- returns the remaining languages and a language to switch to,
- refuses to remove the **last** translation (`LAST_TRANSLATION`), because a song with no
  translation cannot be rendered.

To delete the song itself, use the admin delete action on the song page.

## Publish

A new translation starts unpublished. An admin can flip **Published** in the editor toolbar. A
`reviewer` can edit but not publish. See
[Edit and publish a song](./edit-and-publish-a-song.md).

## See also

- [Tutorial 2 — Add a translation and publish it](../tutorials/02-add-a-translation.md)
- [Content model reference](../reference/content-model.md)
