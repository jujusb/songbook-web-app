# Enable Spotify and Navidrome players

The app can embed audio players on song and album pages. All of it is optional and driven by
environment variables; with none set, pages simply have no players.

## The three integrations

| Integration | Variables | What it adds |
| --- | --- | --- |
| Original recordings | `SONGBOOK_NAVIDROME_SONGS_URL`, `SONGBOOK_NAVIDROME_USERNAME`, `SONGBOOK_NAVIDROME_PASSWORD` | Navidrome (Subsonic) share links for non-default-language versions of a song |
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | automatic Spotify embed of the original (default-language) version |
| Per-voice recordings | `SONGBOOK_VOICES_NAVIDROME_SONGS_URL`, `SONGBOOK_VOICES_NAVIDROME_USERNAME`, `SONGBOOK_VOICES_NAVIDROME_PASSWORD` | per-voice-part players at the top of every song page |

Each integration is enabled only when **all** of its variables are present and valid.

## Spotify

Create an app in the Spotify Developer Dashboard to get a client id and secret, then:

```bash
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

The app treats the version in the site's default language as the **original**. For it, it searches
Spotify by artist and song (or album) title, picks the best match, and embeds the player directly on
the page. Without credentials, the UI falls back to plain Spotify search links.

Explicit URLs always win. Set them in the song's `meta.yaml`:

```yaml
spotify:
  song: https://open.spotify.com/track/...
youtube: https://www.youtube.com/watch?v=...
```

and on the album in `album.yaml` (`spotify`, `youtube`, `youtubePlaylist`). URLs are validated: a
Spotify link must start with `https://open.spotify.com/`, a YouTube link with
`https://www.youtube.com/` or `https://youtu.be/`.

## Navidrome (originals)

For translations other than the default language, the app offers a Navidrome share instead of
Spotify. Set:

```bash
SONGBOOK_NAVIDROME_SONGS_URL=https://music.example.com
SONGBOOK_NAVIDROME_USERNAME=navidrome
SONGBOOK_NAVIDROME_PASSWORD=...
```

The Navidrome server must run with `EnableSharing=true`, and the configured user must be allowed to
create shares.

## Navidrome (VOICES, per voice part)

The second instance adds per-voice practice players on every song page. See
[Generate per-voice practice playlists](./generate-voice-playlists.md) for the matching rules and the
setlist-level feature.

## Precedence on a song page

For the **original** (default-language) version: an explicit `spotify.song` URL first, then the
automatic Spotify lookup. For **other** languages: an explicit Navidrome share, with the automatic
Navidrome search as fallback. Per-voice players, when configured, are independent and appear
regardless of language.

## Troubleshooting

- **No players at all.** At least one variable is missing or invalid; an invalid URL in the Navidrome
  config disables that integration silently.
- **Spotify shows a search link, not a player.** Credentials are missing or the lookup found no
  match.
- **Navidrome errors.** Check the API returns `ok:false` with `unconfigured` or `search_failed` in
  the network response; the UI hides the player in that case.

## See also

- [Environment variables](../reference/environment-variables.md) — the full list and defaults
- [Generate voice playlists](./generate-voice-playlists.md)
- [Content model reference](../reference/content-model.md) — where explicit links live
