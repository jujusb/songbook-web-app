# API endpoints

Every handler is under `src/app/api/`. Handlers are plain route functions and check authorization
themselves. "RO" means read-only mode returns a 403 (or the guard is inert). Unless stated, a
successful mutation returns JSON.

> **Authorization is not uniform.** Some handlers require a role; others only check read-only mode.
> This is called out per endpoint, and collected at the bottom.

## Auth

| Method + path | Body / query | Response | Access |
| --- | --- | --- | --- |
| `POST /api/auth/login` | `{username, password}` | `{success, role}` + session cookie | login guard inert; seeds default admin |
| `POST /api/auth/logout` | — | `{success}` or `{success, redirectUrl}` | logout guard inert |
| `GET /api/auth/me` | — | `{user}` or `{user:null}` | public; null in read-only mode |
| `POST /api/auth/register` | `{username, password, displayName?}` | `{success, role, userId}` + cookie | register guard inert; role `setlist_creator` |
| `GET /api/auth/oidc` | — | 302 to provider + `oidc-state` cookie | 403 in read-only; 404 if unconfigured |
| `GET /api/auth/oidc/callback` | `?code ?state ?error` | 302 `/browse` + cookie, or 302 `/login?error=` | 403 in read-only; state verified |

## Songs

| Method + path | Body / query | Response | Access |
| --- | --- | --- | --- |
| `GET /api/songs` | `?all=true` | published songs by default; all with `?all=true` | public; `?all=true` needs Admin |
| `POST /api/songs` | `{id, title, lang?, chordpro?, albumId?}` | `{success, id}` 201 | RO 403; **no role check** |
| `DELETE /api/songs` | `?id=` | `{success}` | RO 403; Admin |

## Song revisions

All four take `?lang=` (default `en`). All are gated by `isReadOnlyFor('song_write')` (403) and by
`canEdit(role) || canEditSong(user, id, lang)` (401).

| Method + path | Response |
| --- | --- |
| `GET /api/songs/[id]/revisions` | `{revisions, songId, lang}` |
| `GET /api/songs/[id]/revisions/[timestamp]` | `{content, timestamp, songId, lang}` |
| `POST /api/songs/[id]/revisions/[timestamp]/revert` | snapshots current, applies the revision |
| `POST /api/songs/[id]/revisions/[timestamp]/publish` | applies without snapshot; sets `published:true`, `publishedRevision` |

## Albums

| Method + path | Body / query | Response | Access |
| --- | --- | --- | --- |
| `GET /api/albums` | `?all=true` | published albums by default | public; `?all=true` needs Admin |
| `POST /api/albums` | full `AlbumSchema` | `{success, id}` 201 | RO 403; Admin |
| `PUT /api/albums` | full `AlbumSchema` | `{success, id}` | RO 403; **no role check** |
| `DELETE /api/albums` | `?id=` | `{success}` | RO 403; **no role check** |

## Artists

| Method + path | Body / query | Response | Access |
| --- | --- | --- | --- |
| `GET /api/artists` | — | `Artist[]` | public |
| `POST /api/artists` | `ArtistSchema` | `{success, id}` 201 | RO 403; **no role check** |
| `PUT /api/artists` | `ArtistSchema` | `{success, id}` | RO 403; **no role check** |
| `DELETE /api/artists` | `?id=` | `{success}` | RO 403; **no role check** |

## Setlists

| Method + path | Body / query | Response | Access |
| --- | --- | --- | --- |
| `GET /api/setlists` | — | editors see all; others see public or own | public (filtered) |
| `POST /api/setlists` | `{title, description?, date?, songs?, voiceShares?}` | new `Setlist` 201; `ownerId` = caller | RO guard inert; `canCreateSetlist` |
| `PUT /api/setlists` | `{id, title, description?, date, songs}`; preserves shares/owner | updated `Setlist` | RO guard inert; `canCreateSetlist`; owner or `canEdit` |
| `DELETE /api/setlists` | `?id=` | `{success}` | RO guard inert; `canCreateSetlist`; owner or Admin |

## Users (admin)

All four are gated by `isReadOnlyFor('user_write')` (403) and Admin (401).

| Method + path | Body / query | Response |
| --- | --- | --- |
| `GET /api/admin/users` | — | users without `passwordHash` |
| `POST /api/admin/users` | `{username, password, displayName?, email?, role?='reviewer'}` | created user 201 |
| `PUT /api/admin/users` | `{userId, permissions?, role?, displayName?, email?}` | updated user; self-modification blocked |
| `DELETE /api/admin/users` | `?id=` | `{success}`; self-deletion blocked |

## PDF

| Method + path | Body / query | Response | Access |
| --- | --- | --- | --- |
| `POST /api/pdf` | `{type:'chords'\|'instrumental', scope, id?, share?, lang?, langs?, refs?, repeatChorus?, instrument?, files?}` | `application/pdf`; 400 if empty scope; 500 on render failure | public; setlist scope via `canViewSetlist`; `files` intersected against allowed partitions |
| `GET /api/pdf` | `?setlist=` (+`?share=`) | PDF of a setlist print page (legacy) | `canViewSetlist` else 404 |

## Files

| Method + path | Notes | Access |
| --- | --- | --- |
| `GET /api/music/[...path]` | serves audio from `MUSIC_DIR`; traversal-proof; mime-mapped; `Cache-Control: public, max-age=86400` | public |
| `GET /api/partitions/[...path]` | serves **PDF only** from `getPartitionsDir()`; traversal-proof; 400 for non-PDF | public |

## Integrations

All are POST and all check only their configuration, not the caller's role.

| Method + path | Body | Response |
| --- | --- | --- |
| `POST /api/voices` | `{id, lang}` | `{ok:true, data:{groups}}` or `{ok:false, error}` |
| `POST /api/spotify/lookup` | `{type:'song'\|'album', id, lang}` | `{ok, data}` or error |
| `POST /api/navidrome/share` | `{type:'song'\|'album', id, lang}` | `{ok, data}` or error |

## Config

| Method + path | Response | Access |
| --- | --- | --- |
| `GET /api/languages` | `{languages, default}` | public |

## Authorization inconsistencies

These are real and worth knowing before you rely on the API:

- `POST /api/songs`, `PUT`/`DELETE /api/albums`, and `POST`/`PUT`/`DELETE /api/artists` check only
  read-only mode. They have **no session or role check**. In a writable instance they can be called
  by an unauthenticated client.
- `POST /api/albums` and `DELETE /api/songs` do require Admin, so the inconsistency is not uniform
  even within a resource.
- The integration endpoints are public by design: they only return data the caller could already
  get from a song page, and they fail closed when unconfigured.

If you run a writable instance exposed to the internet, put it behind your own authentication or
fix the missing checks. The [read-only deployment](../how-to/run-a-public-read-only-instance.md) is
the intended boundary for public traffic.
