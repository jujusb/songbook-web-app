<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Songbook Web App

Self-hosted, file-based songbook. No database — all data lives as YAML + ChordPro (`.cho`) files under `content/`. Read `songbook-web-app.md` for the full architecture spec.

## Commands

- `npm run dev` — dev server (port 3000; Docker maps to 3100)
- `npm run build` — production build (standalone output)
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- No test suite, no formatter, no pre-commit hooks

## Dev environment

Runs in Docker via `docker-compose.yml`, which builds the multi-stage `Dockerfile` (`npm run build`) and runs the production server. `content/` and `music/` are bind-mounted as volumes. Do not run `npm install` on the host — dependencies are installed inside the build.

Production Dockerfile installs Chromium + Noto fonts for Puppeteer PDF generation. Env vars `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` and `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` are set in the image.

## Key env vars

- `ADMIN_PASSWORD` — seed password for auto-created admin user (default: `"admin"`)
- `JWT_SECRET` — signing key for session JWTs (default: `"songbook-default-secret-change-me"`)
- `OIDC_ISSUER` — OIDC provider URL; setting this enables OIDC (auto-sets `oidc.enabled: true`)
- `OIDC_CLIENT_ID` — OAuth2 client ID
- `OIDC_CLIENT_SECRET` — OAuth2 client secret
- `OIDC_LOGOUT_URL` — provider logout endpoint (optional)
- See `docker-compose.yml` for the full set of `OIDC_*` env vars; they override `site.yaml` values

## Architecture

- **Next.js 16** with App Router, React 19, TypeScript (strict), Tailwind CSS v4 (configured in `globals.css`, no `tailwind.config.*`)
- **Path alias:** `@/*` → `src/*`
- `next.config.ts`: `output: "standalone"`, `serverExternalPackages: ["puppeteer", "chordsheetjs"]`

### Content model (`content/`)

```
content/
  config/          — site.yaml, languages.yaml
  artists/         — <artist-id>.yaml
  library/
    <album-id>/
      album.yaml
      <song-id>/
        meta.yaml          — shared song metadata
        <lang>.cho         — ChordPro file per language (en.cho, es.cho, …)
        .revisions/        — timestamped .cho snapshots
```

All content schemas are Zod-validated in `src/lib/content/schemas.ts`. CRUD operations are in `src/lib/content/index.ts` using `fs/promises`.

### Auth

Custom JWT auth (no NextAuth). Users stored as YAML in `content/users/`. Bcrypt password hashing, HTTP-only cookie (`songbook-session`), 7-day expiry. Three roles: `public` (read), `reviewer` (read+edit), `admin` (full). Auth checked per-route via `getSession()`/`getCurrentUser()` — no middleware.

Optional OIDC support configured in `site.yaml` (`oidc:` block). Uses standard Authorization Code flow with OIDC Discovery. Client secret via `OIDC_CLIENT_SECRET` env var. OIDC users are auto-provisioned with `authProvider: 'oidc'` in their YAML file. Role mapping from OIDC claims is configurable. See `src/lib/auth/oidc.ts` for the implementation.

### Key libraries

- `chordsheetjs` — ChordPro parsing, rendering, transposition
- `jose` — JWT
- `puppeteer` — PDF generation (requires Chromium in prod container)
- `@codemirror/*` — song editor
- `gray-matter` / `js-yaml` — YAML frontmatter

### Server actions

`src/app/actions.ts` has `saveSongAction()` and `createSongAction()` — both call `revalidatePath()` for cache invalidation.

## Conventions

- Songs use ChordPro format (`.cho` extension) with YAML frontmatter
- Multi-language: one `.cho` file per language per song, language code as filename
- Revisions are timestamped `.cho` snapshots in `.revisions/` subdirectories
- API routes live under `src/app/api/`; pages are server components by default
- `run.sh` is a wrapper for `docker compose` that sets up networking and env vars
