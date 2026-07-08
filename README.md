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

Both should be changed for any non-local deployment.

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
        meta.yaml          # title, tags, key, tempo, references
        en.cho             # English lyrics + chords (ChordPro format)
        es.cho             # Spanish translation
        .revisions/        # timestamped .cho snapshots
```

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

## License

See [LICENSE](LICENSE) if present.
