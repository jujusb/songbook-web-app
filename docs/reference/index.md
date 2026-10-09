# Reference

Reference describes what the code *is*, precisely and without narrative — every content schema,
route, endpoint, action, and configuration setting. Each page lists its source files so you can read
the code next to it.

Start with the [content model](./content-model.md) if you are new: it is the base everything else
operates on.

## The content model

- [Content model](content-model.md) — the folder tree, every schema field, and the reserved `no-album` id
- [ChordPro subset](chordpro.md) — the directives and section types the app understands

## Configuration and access

- [Environment variables](environment-variables.md) — the app-read variables, the Compose-only
  variables, and the two-way mapping
- [Configuration](configuration.md) — `site.yaml` and the `oidc:` block, field by field
- [Roles and permissions](roles-and-permissions.md) — the four roles, capability helpers, and the
  reviewer permission model
- [Authentication](authentication.md) — sessions, cookies, login/register/logout, and OIDC
- [Read-only mode](read-only.md) — what `SONGBOOK_READONLY=1` allows and blocks

## Interfaces

- [Routes](routes.md) — every page, what it renders, and who can reach it
- [API endpoints](api-endpoints.md) — every handler, method, body, response, and access rule
- [Server actions](server-actions.md) — every action in `src/app/actions.ts`

## Conventions used in these pages

- **Field tables list the exact source values**, read out of `src/lib/content/schemas.ts` rather
  than out of the README. Where the README and the code disagree, the code (and this reference)
  win, and the discrepancy is called out rather than smoothed over.
- **Defaults are read out of the source**, so a default in a table is the one that actually runs
  (for example `LANGUAGES_DEFAULT` defaults to the first enabled language, not to `en`).
- **Authorization gaps are named.** Several endpoints and actions check only read-only mode and
  skip the role. These are listed explicitly, not hidden.

## See also

- [How-to guides](../how-to/README.md)
- [Explanation](../explanation/README.md) — why the code is this way
- [Tutorials](../tutorials/README.md) — if you are new here