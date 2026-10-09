# Reference

Material you look things up in. Reference is not a lesson and not a task guide: it describes what
exists, precisely, without narrative.

Unlike some projects, **nothing here is generated.** The app has no JSDoc extraction step, so every
page is hand-written. Each page names the source file it describes, so you can read the code next
to the documentation and check it yourself.

## The content model

| Page | Contents |
| --- | --- |
| [Content model](./content-model.md) | Every file and folder under `content/`, its schema, and the reserved ids |
| [ChordPro subset](./chordpro.md) | The ChordPro directives the app understands and how sections map to the UI |
| [Configuration](./configuration.md) | `site.yaml` and the `oidc:` block, field by field |

## Configuration and access

| Page | Contents |
| --- | --- |
| [Environment variables](./environment-variables.md) | Every variable the app reads, its default, and what it changes |
| [Roles and permissions](./roles-and-permissions.md) | The four roles, the capability helpers, and the per-reviewer permission model |
| [Authentication](./authentication.md) | Sessions, cookies, the login/register/logout routes, and OIDC |
| [Read-only mode](./read-only.md) | Which operations `SONGBOOK_READONLY=1` allows and blocks |

## Interfaces

| Page | Contents |
| --- | --- |
| [Routes](./routes.md) | Every page route, what it renders, and who can reach it |
| [API endpoints](./api-endpoints.md) | Every `/api/**` handler, its methods, bodies, responses and required role |
| [Server actions](./server-actions.md) | Every action in `src/app/actions.ts`, its parameters and what it revalidates |

## See also

- [How-to guides](../how-to/README.md)
- [Explanation](../explanation/README.md) — why the code is this way
