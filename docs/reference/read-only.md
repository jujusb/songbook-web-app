# Read-only mode

Read-only mode is a deployment profile, enabled by `SONGBOOK_READONLY=1` (only the exact string
`1`). It turns a write-capable instance into a public one without removing the ability to log in or
build setlists. The gate is `isReadOnlyFor(op)` in `src/lib/readonly.ts`.

## Operations

`isReadOnly()` (`src/lib/readonly.ts:13`) is true when the env var is `1`. `isReadOnlyFor(op)`
returns whether a specific operation is blocked. There is an allow-list of operations that keep
working:

```
login, logout, register, setlist_write, setlist_share
```

Everything else returns true (blocked): `user_write`, `song_write`, `album_write`, `artist_write`,
`partition_write`.

## What is allowed

| Operation | Behaviour in read-only mode |
| --- | --- |
| Reading published content | works |
| Password login / OIDC | works |
| Self-registration | works; new users get `setlist_creator` |
| Create/edit own setlists | works |
| Public flag, share token, slug | works |
| Generate voice playlists | works |

## What is blocked

| Operation | Effect |
| --- | --- |
| Edit songs / translations | `canEdit` false; routes 404 or redirect; actions return `READ_ONLY` |
| Publish a revision / toggle published | blocked |
| Create/rename/delete songs, albums, artists | `notFound()` or `{ ok: false }` |
| User management | `canAdmin` false; `/admin/users` 404s |
| Scan/apply partitions | `/admin/partitions` 404s; actions return `READ_ONLY` |
| Song/Album/Artist POST, PUT, DELETE APIs | 403 |
| `/api/auth/me` | returns `{ user: null }` |

## The inert guards

Because `login`, `logout`, `register`, `setlist_write`, and `setlist_share` are on the allow-list,
`isReadOnlyFor(...)` returns `false` for them. Any guard that calls `isReadOnlyFor` with one of
those operations is therefore dead code today: the login, logout, register, setlist create, and
setlist share routes all carry checks that never trip. This is intentional (those operations are
meant to work) but it means the guard is not protecting anything — the allow-list in `readonly.ts`
is the real policy.

## Filesystem-level enforcement

Read-only mode is an application-level policy. For defence in depth, mount the content and
partitions volumes read-only in the public container, as the repository's `songbook-public` service
does. Then even a bug in the checks cannot write to the library. The trade-off is that
self-registration needs a writable `content/users/`; see
[Run a public read-only instance](../how-to/run-a-public-read-only-instance.md).

## See also

- [ADR-0007 — Read-only mode is a deployment profile](../explanation/decisions/0007-read-only-mode-is-a-deployment-profile.md)
- [Roles and permissions](./roles-and-permissions.md)
- [Environment variables](./environment-variables.md)
