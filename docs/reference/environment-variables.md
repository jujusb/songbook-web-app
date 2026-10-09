# Environment variables

Two kinds of variables matter: ones the **app reads** at runtime (from `process.env` in `src/`), and
ones the **Compose file** uses to arrange mounts and pass values through. They are listed
separately, because confusing the two is the most common configuration mistake.

## Variables the app reads

| Variable | Default | Read in | Effect |
| --- | --- | --- | --- |
| `JWT_SECRET` | `songbook-default-secret-change-me` | `src/lib/auth/index.ts:11` | signs and verifies session JWTs |
| `ADMIN_PASSWORD` | `admin` | `src/lib/auth/index.ts:216` | seed password when the admin account is auto-created |
| `SONGBOOK_READONLY` | unset | `src/lib/readonly.ts:14` | `1` enables read-only mode |
| `LANGUAGES` | fallback list | `src/lib/content/index.ts:511` | comma-separated enabled language codes |
| `LANGUAGES_DEFAULT` | first enabled | `src/lib/content/index.ts:517` | default language code |
| `SONGBOOK_APP_NAME` | `Songbook` | `src/app/layout.tsx:25` | header brand and metadata title |
| `SONGBOOK_CONTACT_EMAIL` | empty | `src/app/layout.tsx:26` | footer `mailto:` link |
| `SONGBOOK_GITHUB_URL` | project repo | `src/app/layout.tsx:27` | footer link |
| `SONGBOOK_PUBLIC_URL` | request origin | setlist share links | base URL for share links |
| `MUSIC_DIR` | `public/music` | `src/lib/lyrics-sync.ts:7` | root for audio served by `/api/music/...` |
| `PARTITIONS_DIR` | `public/partitions` | `src/lib/partitions.ts:29` | root for sheet-music PDFs |
| `PORT` | `3000` | Next.js server | listen port |
| `NODE_ENV` | — | auth cookie | `production` marks the session cookie `Secure` |

### OIDC

All optional; setting `OIDC_ISSUER` is the trigger that enables OIDC. Env values override
`site.yaml`.

| Variable | Default |
| --- | --- |
| `OIDC_ISSUER` | — |
| `OIDC_CLIENT_ID` | — |
| `OIDC_CLIENT_SECRET` | — (required; never read from `site.yaml`) |
| `OIDC_SCOPES` | `openid profile email` |
| `OIDC_ROLE_CLAIM` | `groups` |
| `OIDC_ROLE_ADMIN` | — |
| `OIDC_ROLE_REVIEWER` | — |
| `OIDC_DEFAULT_ROLE` | `public` |
| `OIDC_BUTTON_LABEL` | `Sign in with SSO` |
| `OIDC_AUTO_REDIRECT` | `false` |
| `OIDC_LOGOUT_URL` | — |

### Integrations

Enabled only when every variable in the group is present and valid.

| Group | Variables |
| --- | --- |
| Navidrome originals | `SONGBOOK_NAVIDROME_SONGS_URL`, `SONGBOOK_NAVIDROME_USERNAME`, `SONGBOOK_NAVIDROME_PASSWORD` |
| Navidrome VOICES | `SONGBOOK_VOICES_NAVIDROME_SONGS_URL`, `SONGBOOK_VOICES_NAVIDROME_USERNAME`, `SONGBOOK_VOICES_NAVIDROME_PASSWORD` |
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |

`SONGBOOK_VOICES_MATCHING_FILE` (default: `<cwd>/content/config/voices.json`, read in
`src/lib/navidrome/voices.ts`) is **optional** and overrides where the voice-matching JSON file is
read from. The default lives in the bind-mounted content tree, so you normally do not need to set
it. The file itself is not an app variable — see
[Generate per-voice practice playlists](../how-to/generate-voice-playlists.md#override-the-vocabulary-with-a-json-file).

## Variables only Compose uses

`docker-compose.yml` maps these `SONGBOOK_*` variables onto the app's real variables and mounts.
They are set in `.env`, not inside the app.

| Variable | Passed to | Purpose |
| --- | --- | --- |
| `SONGBOOK_CONTENT_DIR` | host side of the `/app/content` mount | where the content tree lives on the host; **the app does not read this** |
| `SONGBOOK_MUSIC_DIR` | host side of `/app/music` | audio folder |
| `SONGBOOK_PARTITION_DIR` | host side of `/app/partitions` | sheet-music folder |
| `SONGBOOK_LANGUAGES` | `LANGUAGES` | enabled languages |
| `SONGBOOK_LANGUAGES_DEFAULT` | `LANGUAGES_DEFAULT` | default language |
| `SONGBOOK_PUBLIC_PORT` | host port of `songbook-public` | public instance port (default `9000`) |
| `SONGBOOK_PUBLIC_URL` | passed through | share-link base URL |
| `ADMIN_PASSWORD` | hashed by `run.sh` to `ADMIN_PASSWORD_HASH` | seed password |

`run.sh` also exports `COMPOSE_PROJECT_NAME`, `SONGBOOK_DATA_SUBDIR`, and `COMPOSE_FILE` for the
duration of the Compose call.

## Notes

- **The content directory is not configurable at runtime.** `getContentDir()` returns
  `<cwd>/content` (`src/lib/content/index.ts:28`). In Docker, cwd is `/app` and the host folder is
  selected by the `SONGBOOK_CONTENT_DIR` bind mount. Outside Docker, run from the folder containing
  `content/`.
- **`LANGUAGES` versus `SONGBOOK_LANGUAGES`.** The app reads `LANGUAGES`; Compose translates
  `SONGBOOK_LANGUAGES` into it. Setting `SONGBOOK_LANGUAGES` on a bare host has no effect.
- **The fallback language list** comes from `FALLBACK_LANGUAGES` in `src/lib/i18n/labels.ts` when
  `LANGUAGES` is unset.
- **`SONGBOOK_READONLY` is exact.** Only the string `1` enables it; `true` does not.

## See also

- [Configuration](./configuration.md)
- [Read-only mode](./read-only.md)
- [Run it locally](../how-to/run-it-locally.md)
