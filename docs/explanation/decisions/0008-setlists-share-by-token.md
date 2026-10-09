# 0008 — Setlists share by token, never by account

- **Status:** Accepted
- **Date:** 2026-07-08 → 2026-09-24
- **Relevant code:** `src/lib/content/setlists.ts`, `src/app/setlists/share/[token]/`, setlist YAML

## Context

Setlists are the event-planning feature: pick the songs, order them, present them, and hand them
to the musicians. Sharing them had to work for readers who have no account at all — the whole
point of setlist sharing on a [read-only deployment](./0007-read-only-mode-is-a-deployment-profile.md)
is that the musicians aren't users of the app.

The sharing model grew from `8bd581f` (2026-07-08, setlist management) through `6361ec1`
(2026-09-24, read-only setlist view + sharing controls).

## Decision

- A setlist is a YAML record with an `ownerId`, a public flag, and a share token
  (`crypto.randomUUID()`, optional friendly slug).
- `/setlists/share/[token]` renders the setlist to anyone, with no login; the dedicated share
  presentation pages and PDF share use the same token.
- `canViewSetlist` is: owner, or editors (`canEdit`), or `isPublic`, or a valid share token.
- Share management (create, revoke, slug) lives in server actions gated by `canManageSetlistShares`
  — owner or editor — and remains *active in read-only mode*, because sharing is exactly what a
  read-only instance must allow.

## Consequences

**Positive**

- Musicians reach their setlist from a phone with a link; no account, no session, no friction.
- Tokens are revocable: delete the token, the link dies.
- The public flag gives a second, URL-less path (the setlist appears on browse/setlists).

**Negative**

- The share is bearer-auth by a secret in a file that might itself be committed under git
  ([ADR-0001](./0001-files-not-a-database.md)). The secret is only as private as the content repo.
- The optional friendly slug (`/share/my-slug`) is deliberately human-readable but guessable. The
  docs recommend not using a slug for anything sensitive.
- Share pages intentionally leak that the setlist exists; nothing on them identifies the owner,
  which makes takedown harder for abusive content.

**Carried forward**

- Setlist writes in read-only mode is the *one* exception to the read-only contract. It is the
  active design, not an oversight — see the allow-list in
  [ADR-0007](./0007-read-only-mode-is-a-deployment-profile.md).

## Evidence

- `8bd581f` — setlist management.
- `6361ec1` — read-only setlist view and sharing controls.
- Share pages: `src/app/setlists/share/[token]/{page.tsx,present}`.
- How-to: [share a setlist](../../how-to/share-a-setlist.md).