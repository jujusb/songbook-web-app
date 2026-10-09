# Content model

Everything the app persists lives under the content directory, `getContentDir()` =
`path.join(process.cwd(), 'content')` (`src/lib/content/index.ts:28`). It is a plain folder tree of
YAML and ChordPro files. Schemas are defined with Zod in `src/lib/content/schemas.ts`; CRUD lives
in `src/lib/content/index.ts`.

> **The content path is fixed, not configurable.** The app always reads `<working directory>/content`.
> In the Docker image the working directory is `/app`, so the host folder is chosen entirely by the
> Compose bind mount (`SONGBOOK_CONTENT_DIR`, a Compose variable, not one the app reads). Outside
> Docker, run the app from the directoryju that contains `content/`, or symlink it there. There is no
> `SONGBOOK_CONTENT_DIR` read in `src/`.

## Layout

```
content/
  config/
    site.yaml           app-level settings (auto-created with defaults)
    voices.json         optional per-language VOICES matching vocabulary
  artists/
    <artist-id>.yaml
  library/
    <album-id>/
      album.yaml
      <song-id>/
        meta.yaml
        <lang>.cho
        .revisions/
          <lang>/
            <timestamp>.cho
  setlists/
    <setlist-id>.yaml
  users/
    <user-id>.yaml
```

There is one reserved album id, `no-album` (`NO_ALBUM_ID`, `src/lib/content/index.ts:42`). Songs
under `library/no-album/` exist and render, but are not listed in any `album.yaml`.

> `config/languages.yaml` appeared in the original design and in older READMEs. The app does **not**
> read it. Languages come from environment variables. See
> [ADR-0012](../explanation/decisions/0012-languages-come-from-configuration.md).

## `album.yaml` (`AlbumSchema`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | required; equals the folder name |
| `title` | string | required |
| `artist` | string | required; an artist id |
| `year` | number | optional |
| `number` | number | optional; used for ordering |
| `description` | string | optional |
| `tags` | string[] | default `[]` |
| `songs` | string[] | default `[]`; song ids, in track order |
| `titles` | `Record<lang,string>` | optional; localized album titles |
| `created` | string \| date | optional |
| `spotify` | string | optional; must start `https://open.spotify.com/` |
| `youtube` | string | optional; must start `https://www.youtube.com/` or `https://youtu.be/` |
| `youtubePlaylist` | string | optional; same validation |
| `published` | boolean | default `false` |

An album is treated as published for listing purposes when at least one of its songs is published
in the requested language (`src/lib/content/index.ts`).

## `meta.yaml` (`SongMetaSchema`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | required |
| `title` | string | required; canonical title |
| `titles` | `Record<lang,string>` | optional; localized titles |
| `tags` | string[] | default `[]` |
| `key` | string | optional; musical key |
| `capo` | number | optional |
| `tempo` | number | optional |
| `ccli` | string | optional; CCLI number |
| `created` | string \| date | optional |
| `references` | `Reference[]` | default `[]`; the cross-reference panel |
| `audioFiles` | `AudioFile[]` | default `[]` |
| `partitions` | `Partition[]` | default `[]`; linked sheet-music PDFs |
| `spotify` | `{ song?: string }` | optional; explicit Spotify track URL |
| `youtube` | string | optional; explicit YouTube URL |

### `Reference`

| Field | Type | Notes |
| --- | --- | --- |
| `type` | string | free-form, e.g. `bible`, `song`, `text`, `link` |
| `label` | string | displayed label, e.g. `1 Timothy 1:15` |
| `target` | string | e.g. `bible-kjv/1-timothy-1` or a song id |
| `line` | number | optional; content-line anchor |
| `verse` | string | optional; matches `{start_of_verse: <value>}` |
| `chorus` | string | optional; matches `{start_of_chorus: <value>}` |
| `text` | string | optional; the referenced text |
| `texts` | `Record<lang,string>` | optional; per-language text |
| `highlight` | string | optional; substring of `text` to highlight |
| `highlights` | `Record<lang,string>` | optional; per-language highlight |
| `locations` | `ReferenceLocation[]` | optional; multiple anchors |

### `AudioFile` and `Partition`

```yaml
audioFiles:
  - lang: en
    voice: masculine-alto      # free-form label
    path: /music/amazing-grace/fr/masculine-alto.mp3
partitions:
  - instrument: cuerdas        # top-level folder under the partitions root
    instrumentLabel: cuerdas   # optional display label
    file: cuerdas/Amazing Grace - guitar.pdf
    title: Amazing Grace - guitar
```

## `<lang>.cho` (`SongTranslationFrontmatterSchema` + ChordPro body)

The file is YAML frontmatter, a blank line, then a ChordPro body. The body is parsed by
ChordSheetJS; the frontmatter is parsed with `gray-matter`.

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `language` | string | — | required |
| `title` | string | — | optional; mirrors the body `{title:}` |
| `translator` | string \| null | — | optional |
| `status` | `draft` \| `review` \| `final` | `draft` | human label |
| `published` | boolean | `false` | visibility gate |
| `publishedRevision` | string | — | timestamp of the published revision |
| `lastModified` | string | — | set on every save |
| `modifiedBy` | string | — | optional |

Adding a translation scaffolds `{title: <localized or canonical title>}\n` as the whole body; it
does not copy lyrics or section structure from another language.

If the frontmatter is absent, `saveSongAction` preserves the existing file's frontmatter and only
rewrites the body.

## `setlists/<setlist-id>.yaml` (`SetlistSchema`)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | string | — | slugified from the title |
| `title` | string | — | required |
| `description` | string | — | optional |
| `date` | string | — | optional, e.g. `2025-07-13` |
| `songs` | `{ songId, lang }[]` | `[]` | ordered; language pinned per item |
| `voiceShares` | `VoiceShare[]` | `[]` | generated Navidrome shares |
| `public` | boolean | `false` | visible to logged-in users |
| `shareToken` | string | — | random token for anonymous sharing |
| `shareSlug` | string | — | optional custom slug |
| `ownerId` | string | — | the user who created it |
| `created`, `modified` | string \| date | — | optional |

## `users/<user-id>.yaml` (`UserSchema`)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | string | — | required |
| `username` | string | — | required |
| `passwordHash` | string | — | absent for OIDC-only users |
| `role` | `public` \| `setlist_creator` \| `reviewer` \| `admin` | — | required |
| `displayName` | string | — | optional |
| `email` | string | — | optional |
| `authProvider` | `local` \| `oidc` | `local` | |
| `oidcSub` | string | — | OIDC subject identifier |
| `created` | string \| date | — | optional |
| `permissions` | `Permissions` | — | optional; narrows a reviewer |
| `voice` | `tenor` \| `bass` \| `alto` \| `soprano` | — | optional; the user's singer voice, selected by default on song/setlist pages |

`Permissions` is `{ editSong: {songId, lang}[], editAlbum: {albumId, lang}[], editLanguage: string[] }`.

## Revisions

A revision is a timestamped copy of one translation, written to
`.revisions/<lang>/<timestamp>.cho` before the file is overwritten or deleted. Saves, reverts, and
translation deletion all produce one. The filename is the ISO timestamp with `:` and `.` replaced
so it is filesystem-safe and sorts in time order.

## Reserved ids

- **`no-album`** — the album folder for songs with no album. Not a real album; not listed in the
  albums page.
