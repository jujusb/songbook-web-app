# Songbook Web App

A self-hosted, file-based songbook application for managing songs with chords, supporting multiple languages, PDF export, and live projection. No database required — all content lives as YAML and [ChordPro](https://www.chordpro.org/) files on disk.

## Features

- **Chord rendering** — ChordPro format with chords displayed above lyrics, transposition controls
- **Multi-language** — one `.cho` file per language per song; switch languages in the viewer
- **Live editor** — CodeMirror 6 with side-by-side preview
- **Projection view** — fullscreen, high-contrast display for live settings; keyboard navigation between sections
- **PDF export** — server-side generation via Puppeteer/Chromium with proper Unicode and font support
- **Translation comparison** — side-by-side view of song translations
- **Revision history** — timestamped snapshots of song edits
- **Role-based access** — three roles: `public` (read), `reviewer` (read + edit), `admin` (full)

## Quick Start

### Docker (recommended)

```bash
# Development
docker compose up

# Production (via run.sh helper)
ADMIN_PASSWORD=your-password ./run.sh up -d
```

The dev server is available at `http://localhost:3100`. Production builds use a standalone Next.js output with Chromium bundled for PDF generation.

### Local development

```bash
npm install
npm run dev
```

Dev server runs on `http://localhost:3000`.

> **Note:** The dev Docker Compose uses a named volume for `node_modules`. If you switch between local and containerized development, be aware they maintain separate dependency trees.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ADMIN_PASSWORD` | Password for the auto-created admin user | `admin` |
| `JWT_SECRET` | Signing key for session JWTs | `songbook-default-secret-change-me` |
| `OIDC_ISSUER` | OIDC provider URL; setting this enables OIDC | _(none)_ |
| `OIDC_CLIENT_ID` | OAuth2 client ID | _(none)_ |
| `OIDC_CLIENT_SECRET` | OAuth2 client secret | _(none)_ |
| `OIDC_SCOPES` | Space-separated scopes | `openid profile email` |
| `OIDC_ROLE_CLAIM` | JWT claim for role mapping | `groups` |
| `OIDC_ROLE_ADMIN` | Claim value that maps to admin role | _(none)_ |
| `OIDC_ROLE_REVIEWER` | Claim value that maps to reviewer role | _(none)_ |
| `OIDC_DEFAULT_ROLE` | Fallback role if no mapping matches | `public` |
| `OIDC_BUTTON_LABEL` | Text for the SSO button on the login page | `Sign in with SSO` |
| `OIDC_AUTO_REDIRECT` | Skip login form, redirect straight to OIDC | `false` |
| `OIDC_LOGOUT_URL` | Provider logout endpoint (optional) | _(none)_ |
| `SONGBOOK_NAVIDROME_SONGS_URL` | Navidrome (Subsonic) base URL used to generate share links | _(none)_ |
| `SONGBOOK_NAVIDROME_USERNAME` | Navidrome user allowed to create shares | _(none)_ |
| `SONGBOOK_NAVIDROME_PASSWORD` | Password for that Navidrome user | _(none)_ |

`ADMIN_PASSWORD` and `JWT_SECRET` should be changed for any non-local deployment. All `OIDC_*` env vars override values in `site.yaml`.

Navidrome share links are only rendered when all three `SONGBOOK_NAVIDROME_*` vars are set, and the Navidrome server must run with `EnableSharing=true`. On song pages, the version in the site's default language (`LANGUAGES_DEFAULT`) is treated as the **original version** and links to Spotify instead — add `spotify:` to the song's `meta.yaml` (and the album's `album.yaml`) with the track/album URLs.

## Content Structure

All content lives under `content/` and can be version-controlled independently, backed up with `rsync`, or moved to another host by copying the folder.

```
content/
  config/
    site.yaml              # app title, default language, PDF page size
    languages.yaml         # enabled languages with display names and RTL flags
  artists/
    <artist-id>.yaml
  users/
    <user-id>.yaml         # auth credentials (bcrypt-hashed passwords)
  library/
    <album-id>/
      album.yaml
      <song-id>/
        meta.yaml          # title, tags, key, tempo, references, spotify
        en.cho             # English lyrics + chords (ChordPro format)
        es.cho             # Spanish translation
        .revisions/        # timestamped .cho snapshots
```

Spotify links live in `meta.yaml` (`spotify.song` / `spotify.album` for the track and its album) and optionally in `album.yaml` (`spotify` for the album page). They are shown instead of Navidrome share links when the song is viewed in the site's default language.

### Song format

Songs use [ChordPro](https://www.chordpro.org/) syntax (`.cho` extension) with a YAML frontmatter header:

```
---
language: en
status: final
---
{title: Amazing Grace}
{key: G}

{start_of_verse}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [Em]saved a [D]wretch like [G]me
{end_of_verse}
```

The frontmatter carries per-translation metadata (language, translator, status). The body is standard ChordPro, portable to other tools like OnSong or SongSelect.

## Tech Stack

- **Next.js 16** (App Router) with React 19 and TypeScript (strict)
- **Tailwind CSS v4** — configured in `globals.css` (no `tailwind.config.*`)
- **ChordSheetJS** — ChordPro parsing, rendering, and transposition
- **CodeMirror 6** — song editor
- **Puppeteer** — PDF generation (headless Chromium)
- **jose** — JWT session management
- **Zod** — schema validation for all content types

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build (standalone output) |
| `npm run lint` | ESLint with flat config |

## Docker

**Development** (`docker-compose.yml`): Bind-mounts source code, uses `node:20-slim`, polls for file changes, maps port 3100 to 3000.

**Production** (`Dockerfile`): Multi-stage build on `node:20-slim`. Installs Chromium and Noto fonts for PDF generation. Runs as non-root user. Content directory is volume-mounted at `/app/content`.

**`run.sh`**: Helper script that creates the Docker network, sets environment variables, and runs `docker compose`.

## Architecture

See [`songbook-web-app.md`](songbook-web-app.md) for the full architecture spec and design rationale.

### Key directories

```
src/
  app/
    actions.ts             # server actions (saveSong, createSong)
    api/                   # REST endpoints (auth, songs, albums, artists, pdf)
    songs/, albums/, artists/  # browse & detail pages
    edit/[songId]/[lang]/  # CodeMirror editor
    present/[songId]/      # projection view
    compare/[songId]/      # translation comparison
    print/[lang]/          # print-layout route (used by Puppeteer)
  components/              # React components (all client-side "use client")
  lib/
    auth/                  # JWT auth, bcrypt, user CRUD, RBAC
    chordpro/              # ChordSheetJS wrappers, text import
    content/               # file-based CRUD, Zod schemas, revision tracking
```

### Auth

Custom JWT-based authentication with no external dependencies. Users are stored as YAML files. Session tokens are HTTP-only cookies (`songbook-session`) with 7-day expiry. An admin user is auto-created on first login if no users exist. Auth is checked per-route — there is no Next.js middleware.

#### OIDC / SSO (optional)

The app supports OpenID Connect for single sign-on. The simplest way to enable it is via env vars in `docker-compose.yml` — just set `OIDC_ISSUER` and the rest:

```yaml
environment:
  - OIDC_ISSUER=https://auth.example.com/realms/main
  - OIDC_CLIENT_ID=songbook
  - OIDC_CLIENT_SECRET=your-client-secret
  - OIDC_LOGOUT_URL=https://auth.example.com/realms/main/protocol/openid-connect/logout
```

Setting `OIDC_ISSUER` automatically enables OIDC. All `OIDC_*` env vars override values in `content/config/site.yaml`, so you can configure everything from Docker without touching YAML files. See the env vars table above for the full list.

Alternatively, configure the `oidc:` block directly in `content/config/site.yaml` (see the commented example there). The client secret is always read from the `OIDC_CLIENT_SECRET` env var for security.

The callback URL to register with your provider is: `https://your-domain/api/auth/oidc/callback`

The app uses standard Authorization Code flow with OIDC Discovery (`/.well-known/openid-configuration`). OIDC users are auto-provisioned on first login. Their role is mapped from a configurable JWT claim (default: `groups`). If no mapping matches, the `defaultRole` (default: `public`) is assigned. Users provisioned via OIDC are stored with `authProvider: oidc` in their YAML file and cannot log in with a password.

When `OIDC_LOGOUT_URL` is set, logging out will clear the local session and redirect the user to the provider's logout endpoint.

Set `OIDC_AUTO_REDIRECT=true` to skip the login form and send users directly to the OIDC provider. Local password login remains available at `/login?error=` (any error parameter prevents the auto-redirect loop).

## License

See [LICENSE](LICENSE) if present.
