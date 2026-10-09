# 0005 — Authorization per route, with no middleware

- **Status:** Accepted; individual checks are easy to skip
- **Date:** 2026-07-08 → present
- **Relevant code:** `src/lib/auth/index.ts`, every `page.tsx`, `src/app/api/*`, `src/app/actions.ts`

## Context

The app is mostly server components, and the data lives on the filesystem
([ADR-0001](./0001-files-not-a-database.md)). The natural Next.js pattern is to gate each route in
its own `page.tsx`: read the session, decide, redirect or `notFound()`. The existence of
`src/middleware.ts` (added `82f81fe`, 2026-10-04) is sometimes read as evidence of central auth —
it is not: that middleware only syncs a `?lang=` query parameter into the `songbook-ui-locale`
cookie, and it explicitly lets `/api` through untouched.

## Decision

- Authorization is checked **in each route** with `getSession()` plus capability helpers:
  `canEdit`, `canAdmin`, `canCreateSetlist`, plus per-target checks like `canEditSong`.
- There is no middleware-based gate, no centralized `authorize()` wrapper, and no route-group
  convention that forces a check.
- Server actions (`src/app/actions.ts`) and API routes are each responsible for their own guard.

## Consequences

**Positive**

- Read costs nothing except a JWT verify; page permissions can be as fine-grained as one method call
  (e.g., `admin` visibility on unpublished translations, `owner || canEdit` on setlists).
- Middleware stays free for its one legitimate job (the locale cookie).

**Negative**

- Every new route must *remember* to check. Nothing makes a private route private; a page that
  forgets `getSession()` is public by default.
- The checks are inconsistent in practice:
  - `POST /api/songs`, `PUT`/`DELETE /api/albums`, and `POST`/`PUT`/`DELETE /api/artists` check
    **only read-only mode** and skip the role entirely, while `DELETE /api/songs` and
    `POST /api/albums` require Admin. The API surface has no uniform policy — see
    [api-endpoints](../../reference/api-endpoints.md).
  - Server actions mostly check only read-only mode too; publishing and setlist-share actions are
    the exceptions.
- Login/logout/register are the only places a session can be created, and read-only mode whitelists
  exactly those — see [ADR-0007](./0007-read-only-mode-is-a-deployment-profile.md).

**Carried forward**

- This is the single most likely source of a security finding. Any roadmap item that introduces a
  new page or handler must pair it with an explicit guard, and the API inconsistency is known and
  catalogued rather than silently relied on.

## Evidence

- `82f81fe` — middleware which only sets the locale cookie: `git show 82f81fe`.
- Route inventory: [routes](../../reference/routes.md), [api-endpoints](../../reference/api-endpoints.md),
  [server-actions](../../reference/server-actions.md).
- `src/lib/auth/index.ts` — `getSession`/`canEdit`/`canAdmin`.