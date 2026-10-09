# Tutorial 2 — Add a translation and publish it

In this tutorial you will take a song that only exists in one language, add a second translation,
edit it, and then publish it so that anonymous visitors can see it. Along the way you will see how
translation files, revisions, and the per-translation `published` flag fit together.

It picks up where [Tutorial 1](./01-first-song.md) left off: the app is running at
<http://localhost:3000> and you are logged in as admin.

## 1. Open a song in the editor

Click **Songs**, then **How Great Thou Art**. This song has only an English translation, so its
language switcher shows a single tab.

Open the action menu at the top-right of the song and choose **Edit**. The editor opens at
`/edit/how-great-thou-art/en`. It is a split view: a [CodeMirror](https://codemirror.net/) pane on
the left holding the ChordPro source, and a live rendered preview on the right.

Look at the toolbar. It shows the song title, the key, the translation status (`final`, `draft`,
…), a **Published / Unpublished** toggle, and buttons for music links, references, and revisions.
The toggle is admin-only.

## 2. Add a translation

At the top of the editor, next to the language tabs, is the **add translation** control. Pick a
language that is not present yet — say **Spanish**.

Creating a translation does not translate anything. It scaffolds an empty ChordPro file for that
language and switches you to it:

```
---
language: es
translator: null
status: draft
published: false
---
{title: How Great Thou Art}
```

A few things are worth noticing:

- The new translation starts as `status: draft` and `published: false`. Nothing is visible to the
  public yet.
- The title came from the song's `titles` map in `meta.yaml` if it had one, otherwise from the
  canonical title. You can set a translated title in the editor's title field; that writes back to
  `meta.yaml`, not to the `.cho` file.

Type or paste the translated lyrics into the CodeMirror pane. Chords are optional: `[G]` before a
syllable places a `G` chord above it, exactly as in the English file.

```
{start_of_verse: 1}
[G]Oh Señor mi [C]Dios, cuando [G]asombrado
...
{end_of_verse}
```

Click **Save**.

## 3. How the save works

When you save, the server:

1. snapshots the **previous** contents of `es.cho` into `.revisions/es/<timestamp>.cho`, and
2. writes the new body with an updated `lastModified` in its frontmatter.

The snapshot happens on every save of an existing translation. That is your undo history — you
never have to think about it. To see it, open the **Revisions** sidebar from the editor toolbar;
each entry can be previewed, reverted to, or published. See
[Restore a revision](../how-to/restore-a-revision.md) and
[ADR-0009](../explanation/decisions/0009-revisions-are-snapshots.md).

## 4. Publish the translation

"Published" is a property of each translation file, not of the song. The English file is still
unpublished; you are about to publish the Spanish one.

In the editor toolbar, click the **Unpublished** toggle. It turns into **Published**. On disk,
`es.cho` now has:

```
---
language: es
status: draft
published: true
lastModified: '...'
---
```

> Publishing is an **admin** action. A `reviewer` can edit songs and add translations but cannot
> flip the published flag. If you want reviewers to publish, you would need to change
> `toggleSongPublishedAction`; see the [roles reference](../reference/roles-and-permissions.md).

## 5. Check what the public sees

Open a private/incognito window (or log out) and visit:

- <http://localhost:3000/songs/how-great-thou-art?lang=es> — visible, because you published it.
- <http://localhost:3000/songs/how-great-thou-art> — the default translation. Since English is
  still unpublished and you are not an admin, this 404s.

Back in your logged-in window, **Songs** shows the song because admins see everything. An
anonymous visitor's **Songs** list, however, only includes songs that have at least one published
translation.

## 6. What you changed on disk

```bash
ls content/library/classic-hymns/how-great-thou-art
# en.cho  es.cho  meta.yaml  .revisions

ls content/library/classic-hymns/how-great-thou-art/.revisions/es
# 2026-...T....cho
```

The song folder gained a translation and a revision. `meta.yaml` may have gained a `titles.es`
entry if you set a translated title. Everything is still plain files.

## What you learned

- A translation is one `<lang>.cho` file inside the song folder.
- Adding a translation scaffolds an empty draft; it does not copy lyrics.
- Each save writes a revision snapshot, so every translation has its own history.
- `published` and `status` live in the translation frontmatter, and `published` controls visibility
  independently of `status`.

Next: [Tutorial 3 — Build and share a setlist](./03-build-and-share-a-setlist.md).
