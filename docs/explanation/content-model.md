# Content model

Why the content tree is shaped the way it is. The exact schemas are in the
[reference](../reference/content-model.md); here is the reasoning.

## A song is a folder

A song is always several things that change at different rates: the English text, the Spanish
translation, the key, the transliterated titles, the references, the sheet-music links. Making a
song a *folder* (`meta.yaml` + `<lang>.cho` files + `.revisions/`) lets the app write one language
without touching another, keeps the shared metadata in one place, and grows a revision history as a
subdirectory. The early design sketch in `songbook-web-app.md` put songs under a flat
`content/songs/`; the implementation moved them under `content/library/<album>/` so that folder =
song and parent folder = album are both true statements about the layout.

## Shared versus per-language metadata

`meta.yaml` holds what is true regardless of language, including localized titles under `titles:`
(canonical title in `title`, the page uses `titles.<lang>` when present). The `.cho` frontmatter
holds what is per-language: `language`, `translator`, `status`, and the visibility flags
`published`/`publishedRevision`.

This split is why a translation can be unpublished while the song exists: "published" is not a
property of the song, it is a property of *this* file. The UI makes the split visible everywhere:
admins see unpublished content, everyone else only published translations. See
[ADR-0010](./decisions/0010-published-is-a-translation-flag.md).

## `no-album`

`library/no-album/` is a reserved folder for songs with no album. It exists so every song always has
a path — the content code has a single `findSongPath` and never a null home — while still letting
albums' `songs:` lists be the *only* thing that puts a song on an album page. Songs under
`no-album` are invisible in album listing until they are moved by `changeSongAlbumAction`. This is
deliberate; it is why creating a song with no album target still works.

## Revisions are copies

The revision system does not diff, does not compress, and does not use git. Every meaningful
overwrite (save of an existing translation, delete, revert) first copies the current file to
`.revisions/<lang>/<timestamp>.cho`, then writes. Copies are dead simple, trivially independent of
any history backend, and cheap at this scale. The cost: every autosave doubles the translation's
file count, and a big session can grow the tree noticeably. `git` on the content folder gives a
second, more compact history if you want one. See
[ADR-0009](./decisions/0009-revisions-are-snapshots.md).

## Languages come from configuration, not a file

The original plan had `content/config/languages.yaml` as the source of languages, with display names
and RTL flags. Commit `0a7abad` (2026-09-24) removed that file and moved languages to environment
variables with display names from `Intl` labels. The result is that Docker configures languages
without content files — important for a setup where content is a separate readonly mount. The old
file still appears in READMEs and in `AGENTS.md`; it is not read. See
[ADR-0012](./decisions/0012-languages-come-from-configuration.md).

## Users are content, too

Users are YAML files in `content/users/`. Auth is "read a file, check a bcrypt hash, sign a JWT".
This is consistent with the file-based bet and makes the whole user store portable and diffable. It
also means the admin account is not seeded by the build — it is created on first login by
`ensureDefaultAdmin()`, because that is when a writable content directory is known to exist. The
`users/` directory is what you commit last of all, because it holds account data; the app repo
gitignores `content/users/admin.yaml`.

## Setlists all in one record

A setlist is a single YAML file holding its ordered songs (each pinned to a language), its owner,
its public flag, its share token/slug, and any generated voice shares. Keeping shares in the same
record as the setlist makes "revoke the share" a single field write, at the cost of storing an
opaque secret in the same diffable artifact you might commit. That is why the
[versioning guide](../how-to/version-your-content.md) suggests deciding per project whether to
commit setlists.

## See also

- [ADR-0001 — Files, not a database](./decisions/0001-files-not-a-database.md)
- [ADR-0012 — Languages come from configuration](./decisions/0012-languages-come-from-configuration.md)
- [Reference: content model](../reference/content-model.md)