# Create users and set their roles

Users are YAML files under `content/users/`. An admin manages them from `/admin/users`; anyone can
self-register at `/register`, which creates a `setlist_creator`.

## Open user management

Log in as `admin` and click **Users** in the header (or go to `/admin/users`). The page lists
accounts and lets you create, edit, and delete them. The route requires the `admin` role and a
writable instance.

## Create a user

Fill in the create form:

| Field | Notes |
| --- | --- |
| Username | required, at least 3 characters |
| Password | required, at least 8 characters |
| Display name | optional |
| Email | optional |
| Role | defaults to `reviewer`; choose any of the four |

Creating writes `content/users/<username>.yaml` with a bcrypt password hash. The plaintext password
is never stored.

## Edit a user

Change the role, display name, or email, or grant **reviewer permissions**. Reviewer permissions are
granular and let you restrict a reviewer to specific work:

- `editSong` — a list of `{songId, lang}` pairs,
- `editAlbum` — a list of `{albumId, lang}` pairs,
- `editLanguage` — a list of language codes.

An admin always has full access regardless of permissions. A reviewer with an empty permission set
can edit everything (the default); permissions narrow that rather than widen it. See
[Roles and permissions](../reference/roles-and-permissions.md).

## The four roles

| Role | Can do |
| --- | --- |
| `public` | read published content |
| `setlist_creator` | read; create and edit own setlists; manage share links and voice playlists |
| `reviewer` | read; edit songs and albums; add/remove translations; optionally restricted by permissions |
| `admin` | everything, plus create/delete songs, albums, artists; manage users; scan partitions; publish |

The README and `AGENTS.md` sometimes describe three roles; the code has four. The `setlist_creator`
role was added with self-registration. See
[ADR-0006](../explanation/decisions/0006-four-roles-and-granular-permissions.md).

## Safety railings

- An admin **cannot change their own role or permissions** (`self-modification` is blocked).
- An admin **cannot delete their own account**.
- Deleting a user removes their YAML file but leaves their setlists behind; those setlists keep
  their `ownerId` pointing at a missing user. Reassign or delete them separately if it matters.

## Self-registration

`/register` is public unless read-only mode disables it. A new account gets the `setlist_creator`
role and is logged in immediately. On a public instance this is how congregation members get their
own setlists without an admin's involvement.

## See also

- [Roles and permissions](../reference/roles-and-permissions.md)
- [Authentication](../reference/authentication.md)
- [ADR-0003 — Custom JWT authentication](../explanation/decisions/0003-custom-jwt-authentication.md)
