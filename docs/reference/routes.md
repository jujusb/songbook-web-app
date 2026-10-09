# Routes

Every page route is a folder under `src/app/`. Pages are server components by default and check
authorization themselves; there is no middleware. `src/middleware.ts` only mirrors a `?lang=` query
param into the `songbook-ui-locale` cookie and does not touch `/api`.

Access legend:

- **Public** — no check.
- **Editor** — `canEdit` (reviewer/admin) or a per-song/album permission.
- **Admin** — `canAdmin`.
- **SetlistCreator** — `canCreateSetlist`.
- **404** — `notFound()`; **→ /login** — `redirect("/login")`.

## Home and browse

| Route | Renders | Access |
| --- | --- | --- |
| `/` | landing hero and feature cards | Public |
| `/browse` | artist → album → song tree of published songs | Public; edit affordances Editor |
| `/songs` | song list with filters; Bulk Import link | Public; import link Editor + writable |
| `/albums` | album grid | Public; edit Editor |
| `/artists` | artist grid; redirects to `/songs` if `enableArtistPages` is false | Public |
| `/setlists` | setlist cards; non-editors see only public setlists | Public; create Editor/SetlistCreator |

## Songs

| Route | Query | Renders | Access |
| --- | --- | --- | --- |
| `/songs/[songId]` | `?lang`, `?parts=1` | chord sheet, language tabs, references, players, voice sections, partitions | Public; 404 if the selected translation is unpublished and viewer is not admin; edit Editor; delete/admin actions Admin |
| `/songs/new` | `?album` | new-song form | 404 in read-only; → /login if not Editor |
| `/edit/[songId]/[lang]` | `?references=1` | CodeMirror editor + preview | 404 in read-only; → /login if no edit rights; 404 if missing |
| `/compare/[songId]` | `?langs=a,b` | side-by-side translations | Public; 404 if missing |
| `/present/[songId]` | `?display=audience` | fullscreen projection | Public; 404 if missing |
| `/music/[songId]` | `?lang` | audio reader + chart | Public; 404 if missing |
| `/import` | — | bulk importer | 404 in read-only; → /login if not Editor |

## Print and PDF

| Route | Query | Renders | Access |
| --- | --- | --- | --- |
| `/print` | `?album`, `?artist` | print config form | Public |
| `/print/[lang]` | `?song ?album ?artist ?book ?refs ?langs ?repeatChorus` | printable book (scope `song\|album\|artist\|book\|all`); `lang` may be `all` | Public, scope filtered by role |
| `/pdf` | — | PDF export view; `dynamic = "force-dynamic"` | Public; setlist scope guarded by `canViewSetlist` |

## Albums

| Route | Renders | Access |
| --- | --- | --- |
| `/albums/[albumId]` | album header, players, tracklist, Export PDF | Public; unpublished songs hidden from non-editors; edit Editor; change id/delete Admin |
| `/albums/new` | album form | 404 in read-only; → /login if not Editor |
| `/albums/[albumId]/edit` | album form | 404 in read-only; → /login without edit rights; 404 if missing |

## Artists

Routes redirect to `/songs` when `enableArtistPages` is false.

| Route | Renders | Access |
| --- | --- | --- |
| `/artists/[artistId]` | bio, website, tags, albums + songs | Public; unpublished albums hidden from non-admins; delete Admin |
| `/artists/new` | artist form | 404 in read-only; → /login if not Editor |

## Setlists

| Route | Query | Renders | Access |
| --- | --- | --- | --- |
| `/setlists/[setlistId]` | `?share` | header, Present/PDF, share controls, voice playlists, editor or read-only view | 404 unless `canViewSetlist`; delete Admin |
| `/setlists/new` | — | new setlist editor | → /login unless SetlistCreator; 404 in read-only (inert) |
| `/setlists/[setlistId]/present` | `?display`, `?share` | setlist projection | 404 unless `canViewSetlist` |
| `/setlists/[setlistId]/print` | `?share`, `?lang` | print songbook for the setlist | 404 unless `canViewSetlist` |
| `/setlists/share/[token]` | — | **token share page**: read-only view, voice playlists, PDF | Public, no login; 404 if unknown |
| `/setlists/share/[token]/present` | `?display` | projection via share token | Public; 404 if unknown/empty |

## Auth and admin

| Route | Renders | Access |
| --- | --- | --- |
| `/login` | login form + OIDC button; `?error=` banner | already logged in → `/browse`; `oidc.autoRedirect` → `/api/auth/oidc`; register link unless read-only |
| `/register` | registration form | already logged in → `/setlists/new` |
| `/admin/partitions` | partition scan UI | 404 in read-only; → /login unless Admin |
| `/admin/users` | user management | 404 in read-only; 404 unless Admin |

## Notes

- There is no `not-found.tsx`, `error.tsx`, `loading.tsx`, or `template.tsx`; Next.js uses its
  defaults.
- `/pdf` is the only page at `src/app/` that sets a route segment config (`force-dynamic`).
- The unpublished check is not applied uniformly: `/compare`, `/present`, and `/music` do not
  re-check the published flag, so treat their URLs as linkable from content rather than
  advertiseable.
