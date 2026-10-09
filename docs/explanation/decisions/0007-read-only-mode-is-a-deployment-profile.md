# 0007 — Read-only mode is a deployment profile

- **Status:** Accepted
- **Date:** 2026-09-21 → 2026-10-05
- **Relevant code:** `src/lib/readonly.ts`, `src/lib/auth/index.ts` (guards), `src/lib/playlist/*`

## Context

Public consumption is the core use case (congregations, campuses). The obvious way to run a public
reader is a read-only filesystem mount, but the earlier auth model assumed a writable `content/`
with users registered on the fly. A flag was needed that flips the app into "publish only, no
writes" mode *without* walking every page.

Read-only mode landed in `a185b48` (2026-09-21), with registration made conditional on it
(`7685b77`, 2026-10-05) and setlist writing deliberately kept on.

## Decision

- `SONGBOOK_READONLY=1` (exactly the string `1`) makes the app read-only.
- The capability helpers themselves short-circuit: `canEdit`, `canAdmin`, `canCreateSetlist`
  return `false` regardless of session. Writers (`canEditSong`, `canWrite`) also return `false`.
- All mutation routes and actions call `isReadOnlyFor(...)`/`assertWritable()`; pages `notFound()`
  in read-only mode instead of redirecting.
- An **allow-list** stays active in read-only mode: `login` (already-stored users), `logout`,
  `register`, `setlist_write`, `setlist_share`. Visitors can log in, create an account, and build
  and share setlists — but nothing in `content/` changes except setlist YAML for their own setlists.
- Guests are not auto-created in read-only mode; `/api/auth/me` returns `user: null`.

## Consequences

**Positive**

- A public instance needs no accounts pre-seeded to be useful: anonymous readers see songs,
  build/present/print setlists, and share via token, while the mount stays read-only.
- Because guards run at the helper level, the mode is fairly resistant to a page forgetting its own
  check — most writers go through gated helpers.

**Negative**

- "Read-only" is a white lie: setlist creation and sharing, and user registration, still write
  files. Operators who deploy `SONGBOOK_READONLY=1` on a truly read-only mount will hit a wall on
  exactly the feature public users most want (setlists).
- Some guards are inert on purpose (`setlist_write`, `setlist_share`), which reads as a bug unless
  you know the allow-list model.
- The default admin creation respects read-only mode, but a writable-but-public instance still
  bootstraps `admin`/`admin` if `ADMIN_PASSWORD` is unset — read-only mode is the *intended* public
  boundary, not a panacea.

**Carried forward**

- Registration is open in read-only mode (anyone can create a `setlist_creator` account). If an
  operator wants no accounts at all, there is no flag for that; put the instance behind a proxy.

## Evidence

- `a185b48` — read-only mode (2026-09-21).
- `7685b77` — registration gated on read-only; `setlist_creator` added (2026-10-05).
- `01264fe` — read-only setlist view/sharing refinements.
- How-to: [run a public read-only instance](../../how-to/run-a-public-read-only-instance.md),
  [read-only reference](../../reference/read-only.md).