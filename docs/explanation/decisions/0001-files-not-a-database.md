# 0001 — Files, not a database

- **Status:** Accepted
- **Date:** 2026-07-08 (the first commit)
- **Deciders:** initial author
- **Relevant code:** `src/lib/content/index.ts`, `src/lib/content/schemas.ts`, `content/`

## Context

The project description is a self-hosted, file-based songbook. No SQL, MongoDB, or service to run.
The goal was portability: the "database" should be a folder you can back up with `rsync`, keep under
`git`, and eyeball with any editor.

The founding spec (`songbook-web-app.md`) states this explicitly, and the first commit `1ed8912`
(2026-07-08, *"implement user authentication and management system"*) already implements it: users
are YAML files under `content/users/`, the config is `site.yaml`, and there is no ORM anywhere.

## Decision

All content is plain files under `content/`, one format per concern:

- YAML for structured data — `config/site.yaml`, artists, album + song `meta.yaml`, `users/*.yaml`.
- ChordPro (`.cho`) for the things that are text — song translations, with YAML frontmatter.
- `.revisions/<lang>/<timestamp>.cho` snapshots for history.

The content layer (`src/lib/content/index.ts`) is a thin wrapper over `fs/promises`: it reads,
writes, and lists files, then validates the data with Zod (`schemas.ts`). `gray-matter` splits
frontmatter, `js-yaml` parses it. There is no cache that pretends to be a database; the filesystem
is the source of truth on every read.

## Consequences

**Positive**

- The data is diffable, portable, and mergeable with standard tools. Migrations are folder renames.
- Backup and restore are file copies; the content folder is a bind mount in Docker and outlives any
  container.
- A song can be edited by hand on the host while the server runs.

**Negative**

- Listing and searching are filesystem scans with in-memory filters — fine for a songbook, wrong for
  scale.
- There is no index and no transaction. Concurrent writes are last-writer-wins, and nothing in the
  app serializes writes across processes.
- `/api` handlers and server actions both write files; nothing coordinates the two paths
  (see [ADR-0005](./0005-authorization-per-route.md)).

**Carried forward**

- Two write paths (actions + API), two revision writers, no locking across processes — accepted
  because the deployment model assumed a single writer behind Docker's bind mounts.

## Evidence

- `1ed8912` — first commit builds usernames, roles, and routes on top of `content/users/*.yaml`:
  `git show 1ed8912`.
- `b942e16` — keeps `content/config/languages.yaml`; see
  [ADR-0012](./0012-languages-come-from-configuration.md) for what happened to it.
- `songbook-web-app.md` §2 — the founding description of the file-based model.
- `src/lib/content/index.ts:28` — `getContentDir()` resolving `content/` relative to `process.cwd()`
  at runtime, with environment overrides.