# Edit and publish a song

The editor at `/edit/<song-id>/<lang>` is where a translation's body, status, title, key, links,
and references are changed. This guide covers the controls and the publish step.

## Open the editor

From a song page, open the action menu and choose **Edit**. Editing requires the `reviewer` or
`admin` role and a writable instance; otherwise you are redirected to `/login` or get a 404.

## The editor layout

- **Left pane** — the ChordPro source in CodeMirror 6, with syntax support.
- **Right pane** — a live preview rendered with the same engine as the reader.
- **Toolbar** — title, key, status, **Published/Unpublished**, and buttons for music links,
  references, and the revisions sidebar.

## Save

Two save paths exist:

- **Save** writes the body by calling `saveSongAction`. The server parses any YAML frontmatter,
  preserves the existing frontmatter when the body has none, writes the file, and syncs the title.
- **Autosave** is a per-editor toggle that saves as you type. It is a client-side convenience; the
  same server action runs underneath.

Every save of an existing translation first snapshots the previous contents into
`.revisions/<lang>/<timestamp>.cho`. That is automatic and is what the revisions sidebar reads. See
[Restore a revision](./restore-a-revision.md) and
[ADR-0009](../explanation/decisions/0009-revisions-are-snapshots.md).

## Change the title and key

- **Title** calls `setSongTitleAction`, which updates both the `titles` map in `meta.yaml` and the
  `{title:}` directive in the `.cho` body, then revalidates the song and browse pages.
- **Key** calls `setSongKeyAction`, which writes or clears the song-wide key in `meta.yaml`. The
  reader uses it to show the key and to drive transposition.

## Status versus published

These are two different things and both live in the translation frontmatter:

| Field | Values | Controls |
| --- | --- | --- |
| `status` | `draft`, `review`, `final` | a human label shown in the editor; not a visibility gate |
| `published` | `true` / `false` | whether anonymous and `public` users can read the translation |

A `final` translation that is not published is invisible to the public. A `draft` translation that
is published is visible. The default is `draft` and unpublished.

Publishing is an **admin** action: the **Published** toggle calls `toggleSongPublishedAction`, which
returns `Admin required` for anyone else. There is also *publishing a revision* — applying an older
snapshot and marking it published in one step — covered in
[Restore a revision](./restore-a-revision.md).

## Music links and references

- **Music links** edits the explicit Spotify and YouTube URLs stored in `meta.yaml`. They take
  precedence over automatic Spotify lookup and Navidrome sharing. See
  [Enable music players](./enable-music-players.md).
- **References** edits the cross-reference list (Bible verses, related songs, links) that appears
  in the reader's references panel. References can be anchored to a verse or chorus and can carry
  per-language text and highlights.

## After editing

Check the reader as an anonymous user (private window) to confirm what the public actually sees.
Remember that admins see unpublished content, so the logged-in view is more permissive than the
public one.

## See also

- [Restore a revision](./restore-a-revision.md)
- [ChordPro subset](../reference/chordpro.md)
- [Server actions reference](../reference/server-actions.md)
