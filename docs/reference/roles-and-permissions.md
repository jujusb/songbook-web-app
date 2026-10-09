# Roles and permissions

The app has four roles and a small set of capability helpers. Authorization is checked per route;
there is no middleware. The role and permission types live in `src/lib/auth/schemas.ts` and the
helpers in `src/lib/auth/index.ts`.

## The four roles

`roles` (`src/lib/auth/schemas.ts:33`):

| Role | Intended capability |
| --- | --- |
| `public` | read published content |
| `setlist_creator` | read; create/edit own setlists; manage share links and voice playlists |
| `reviewer` | read; edit songs and albums; add/remove translations; optionally narrowed by permissions |
| `admin` | everything; create/delete songs, albums, artists; manage users; scan partitions; publish |

Self-registration assigns `setlist_creator` (`src/app/api/auth/register/route.ts:30`). The source
comment block is at `src/lib/auth/schemas.ts:36`.

## Capability helpers

| Helper | Location | Rule |
| --- | --- | --- |
| `canRead` | `:172` | always `true` |
| `canEdit` | `:176` | `reviewer` or `admin`, and not `song_write` read-only |
| `canAdmin` | `:181` | `admin`, and not `user_write` read-only |
| `canCreateSetlist` | `:186` | `setlist_creator`/`reviewer`/`admin`, and not `setlist_write` read-only |
| `canManageSetlistShares` | `:191` | same three roles, and not `setlist_share` read-only |
| `canViewSetlist` | `:201` | editor, or `public`, or `?share=` matches `shareToken` |
| `canEditSong` | `:225` | admin always; reviewer only with an explicit permission |
| `canEditAlbum` | `:252` | admin always; reviewer only with an explicit permission |
| `canEditLanguage` | `:279` | admin always; reviewer only with `editLanguage` |
| `canEditSongs` | `:302` | whether edit buttons should show for a reviewer |

Each helper takes a `role` or a `UserInput`. They are called per route, in the page or the handler.

## The permission model

A reviewer's `permissions` object (`PermissionSchema`, `src/lib/auth/schemas.ts:3`) has three lists:

```yaml
permissions:
  editLanguage: [es, pt]                 # any edit in these languages
  editSong:
    - { songId: amazing-grace, lang: es }
  editAlbum:
    - { albumId: classic-hymns, lang: en }
```

`canEditSong` and `canEditAlbum` return true for a reviewer when the language is in `editLanguage`
or the specific item is listed. A reviewer with no `permissions` matches none of those lists.

### The sharp edge

`canEdit(role)` ignores permissions entirely: any `reviewer` gets `canEdit === true`. Most editor
routes guard on `canEdit || canEditSong`, and the write server actions themselves check only
read-only mode, not the role. So the permission lists function as **UI filtering rather than a hard
boundary**: a reviewer with an empty permission set is still able to reach the editor and save.
Treat permissions as a convenience for delegating work, not as an access-control guarantee.

## Admin-only operations

`canAdmin` gates user management and partition scanning. Publishing a translation is also
admin-only, but it is enforced inside `toggleSongPublishedAction` (it returns
`{ ok: false, error: 'Admin required' }`) rather than through `canAdmin`.

## Role checks in read-only mode

Read-only mode short-circuits several helpers: `canEdit`, `canAdmin`, `canCreateSetlist`, and
`canManageSetlistShares` return `false` when the corresponding operation is read-only. Because
`setlist_write` and `setlist_share` are *allowed* in read-only mode, `canCreateSetlist` and
`canManageSetlistShares` keep working. See [Read-only mode](./read-only.md).

## See also

- [Authentication](./authentication.md)
- [ADR-0006 — Four roles and granular permissions](../explanation/decisions/0006-four-roles-and-granular-permissions.md)
- [Manage users and roles](../how-to/manage-users-and-roles.md)
