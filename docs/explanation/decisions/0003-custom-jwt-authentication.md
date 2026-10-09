# 0003 — Custom JWT authentication over YAML user files

- **Status:** Accepted
- **Date:** 2026-07-08
- **Relevant code:** `src/lib/auth/*`, `src/app/api/auth/*`, `content/users/*`

## Context

The founding spec (§6) suggested the *simplest possible* access control: "simple static password
protection or, perhaps, a single admin account with a session cookie". The very first commit
(`1ed8912`, 2026-07-08) went further: it implemented a full multi-user system — users, roles,
sessions, and a user-management surface — *without* adopting NextAuth, Lucia, or any auth
framework. The JWT layer (`jose`) is the only third-party auth primitive in the project.

## Decision

Users are YAML files in `content/users/<username>.yaml`. Passwords are bcrypt hashes. Sessions are
JWTs signed HS256 with `jose`, stored in an HTTP-only cookie named `songbook-session`, expiring
after 7 days, carrying `{ userId, role }`. There is no refresh token and no session store. An admin
account is created lazily by `ensureDefaultAdmin()` on first login when no users exist, seeded from
`ADMIN_PASSWORD` (default `admin`).

OIDC was added as an *additional* session source two commits later — see
[ADR-0004](./0004-oidc-is-additive.md).

## Consequences

**Positive**

- Zero external auth services; the whole user store is two functions over `fs` plus a `jose` call.
- The auth model matches the file-based data model ([ADR-0001](./0001-files-not-a-database.md)):
  users are diffable, portable, and restorable.
- Being JWT-only means the app is stateless with respect to sessions: any instance of the same
  `JWT_SECRET` accepts the same cookies.

**Negative**

- The portal auth is security-sensitive code the project owns entirely: cookie options, secret
  handling, and role claims are all in `src/lib/auth/*` and are the first place an audit goes.
- `JWT_SECRET` has a default, and the admin account is automatically created from a default
  password when none is set — a fresh instance exposed before configuration is admin/admin.
- Because there is no server-side session, *revoking* a user is "delete the YAML" and does not kill
  already-issued 7-day cookies.

**Carried forward**

- Per-route authorization with no middleware is a separate decision, torn from this one by
  necessity: see [ADR-0005](./0005-authorization-per-route.md).
- Read-only mode refuses to issue *some* sessions (guests are not created) — see
  [ADR-0007](./0007-read-only-mode-is-a-deployment-profile.md).

## Evidence

- `1ed8912` — the entire user auth + management system:
  `git show 1ed8912`.
- `1c8b8a0`, `edeee08` — OIDC added (2026-07-08) and its tests landed late (2026-10-09).
- `7685b77` — self-registration adds role `setlist_creator` to this model (2026-10-05).
- Reference: [authentication](../../reference/authentication.md).