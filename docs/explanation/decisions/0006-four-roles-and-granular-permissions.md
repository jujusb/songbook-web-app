# 0006 — Four roles, and reviewer permissions are UI affordances

- **Status:** Accepted; reviewer `permissions` are not enforced
- **Date:** 2026-07-08 (RBAC shape) → 2026-10-05 (`setlist_creator`, permission model)
- **Relevant code:** `src/lib/auth/index.ts`, `src/lib/content/schemas.ts`,
  `src/app/actions.ts`, `src/app/api/admin/users/*`

## Context

The first commit defined three roles and a permissions object. The founding spec said three roles —
`public`, `reviewer`, `admin`. By 2026-10-05 the model had grown a fourth role,
`setlist_creator`, added alongside self-registration (`7685b77`) so that registered users can build
setlists for an event without being able to edit songs — the key feature for congregational and
campus deployments.

The reviewer permission model (`editSong`, `editAlbum`, `editLanguage`) was introduced with user
management (`82d447a`) so a reviewer can be granted translation rights without full song-edit
rights.

## Decision

- Four roles, ordered: `public` < `setlist_creator` < `reviewer` < `admin`.
- Registration assigns `setlist_creator`; the default admin is `admin`.
- Reviewers carry a `permissions` list. Capability helpers then decide: `canCreateSetlist`,
  `canEditSong(user, songId, lang)`, `canEditAlbum`, `canEditLanguage` read that list — **but
  `canEdit(role)` and `canAdmin(role)` consider only the role**.

## Consequences

**Positive**

- `setlist_creator` lets public deployments give away setlist creation without editing rights — the
  feature that makes read-only instances useful ([ADR-0007](./0007-read-only-mode-is-a-deployment-profile.md)).
- The permission lists are genuinely read by the UI: song-edit affordances, album-edit actions, and
  language-edit buttons all consult them.

**Negative**

- The permission lists are **not a security boundary.** `canEdit(role)` ignores them, and almost
  every server action checks only read-only mode ([ADR-0005](./0005-authorization-per-route.md)).
  A reviewer without `editLanguage` who navigates directly to an edit URL can still save that
  language. The model is therefore "UI filtering by permission, enforcement by role".
- The old three-role framing lives on in `AGENTS.md` and the README, which still say "three roles"
  and "no test suite" — stale against the code.

**Carried forward**

- Known open item: whether reviewer permissions are *meant* to be a boundary. The ADRs do not record
  an intent; the implementation doesn't enforce one. Decide before promising a customer
  "translation-only reviewers."

## Evidence

- `7685b77` — registration + `setlist_creator`.
- `82d447a`, `c7fdafc` — user management and the permission model.
- Reference: [roles and permissions](../../reference/roles-and-permissions.md).