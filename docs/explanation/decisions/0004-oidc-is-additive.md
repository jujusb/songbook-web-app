# 0004 — OIDC is additively enabled by environment

- **Status:** Accepted; role syncing for existing users is unresolved
- **Date:** 2026-07-08 → 2026-10-09
- **Relevant code:** `src/lib/auth/oidc.ts`, `src/app/api/auth/oidc*, `config/site.yaml` `oidc:` block

## Context

Two days after the hand-rolled session model (`1ed8912`), the project added OpenID Connect support
(`1c8b8a0`). The constraint was that OIDC had to be *optional*: the app must remain runnable with
zero configuration, and deployments that never heard of OIDC must see nothing. Setting `OIDC_ISSUER`
turns it on; unset, the buttons and routes say 404.

The integration follows standard Authorization Code flow with OIDC Discovery, `oidc-client-ts`
style discovery, state param, PKCE, and a single-sign-out redirect.

## Decision

- OIDC is an enabled-by-environment layer over the same session model as
  [ADR-0003](./0003-custom-jwt-authentication.md). It issues the *same* `songbook-session` cookie.
- OIDC users are auto-provisioned as `content/users/*.yaml` with `authProvider: 'oidc'` and no
  password hash; first login creates the file, later logins update `lastLogin`.
- Role mapping resolves provider claims to a role — `admin`, then `reviewer`, then a configurable
  default (`OIDC_DEFAULT_ROLE`, within `public|reviewer|admin`) — and writes it into the user's YAML
  at provision time.
- The mapping intentionally has no `setlist_creator` target.

## Consequences

**Positive**

- A deployment can keep passwords-only locally or point at an IdP; the app does not care.
- The user record remains diffable and portable, consistent with the file-based model.

**Negative**

- Roles are resolved once, at provisioning, and then stored as data. If the IdP later promotes a
  user from reviewer to admin, the app keeps serving the last-resolved role until the YAML record
  is touched again. There is no commit that addresses re-sync.
- The default-role mapping omits `setlist_creator`, so a public instance that wants OIDC users to
  build setlists must map them to `reviewer` (which also grants edit rights) or keep:
  registration. The mapping was designed for admin/reviewer-only vocabulary and has not caught up
  with [ADR-0006](./0006-four-roles-and-granular-permissions.md).

**Carried forward**

- OIDC and the local session share the same cookie namespace. Only one session survives at a time;
  frameworks that stack local + OIDC identities are explicitly not supported.

## Evidence

- `1c8b8a0` — OIDC support (2026-07-08).
- `edeee08` — OIDC tests; the flow was running in production-like conditions before it was pinned..
- How-to: [configure OIDC SSO](../../how-to/configure-oidc-sso.md).