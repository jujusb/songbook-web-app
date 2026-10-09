# Server actions

All server actions live in one module, `src/app/actions.ts` (865 lines). They are the primary way
the UI mutates content; API routes are a thinner parallel path used less by the pages.

Shared guards defined at the top of the file:

- `assertWritable()` (`:12`) — throws when `isReadOnly()`.
- `assertSetlistWrite()` (`:18`), `assertSetlistShare()` (`:24`) — setlist-specific, inert in
  read-only mode.

## Songs

| Action | Line | Does | Role check | Revalidates |
| --- | --- | --- | --- | --- |
| `setSongTitleAction(songId, lang, title)` | 66 | syncs `meta.yaml` titles map + `{title:}` | RO only | `/songs/[id]`, `/edit/[id]/[lang]`, `/songs`, `/browse` |
| `setSongKeyAction(songId, key)` | 89 | sets/clears song key in `meta.yaml` | RO only | same four |
| `saveSongAction(songId, lang, content)` | 101 | preserves frontmatter, writes `.cho`, syncs title | RO only | `/songs/[id]`, `/edit/[id]/[lang]` |
| `toggleSongPublishedAction(songId, lang)` | 136 | flips `frontmatter.published` | **Admin** required | same four |
| `revertSongToRevisionAction(songId, lang, timestamp)` | 156 | snapshots current, applies revision | `canEdit ‖ canEditSong` | four |
| `publishRevisionAction(songId, lang, timestamp)` | 202 | applies revision without snapshot | `canEdit ‖ canEditSong` | four |
| `createSongAction(FormData)` | 245 | slugifies title → `createSong` | RO only | `/songs` |
| `bulkImportSongsAction(items, target?)` | 361 | batch create ≤ 200 songs, find-or-create album | **`canEdit`** throws | `/songs`, `/browse`, `/albums` |
| `saveSongReferencesAction(songId, references)` | 454 | writes `meta.references` | RO only | `/songs/[id]`, `/edit/[id]/[lang]` |
| `saveSongLinksAction(songId, {spotifySong, youtube})` | 463 | writes `meta.spotify`/`meta.youtube` | RO only | `/songs/[id]`, `/edit/[id]/[lang]`, album pages |
| `changeSongIdAction(oldId, newId)` | 483 | `renameSong` (folder move) | RO → `READ_ONLY`; **no role check** | song, edit, list, browse, album paths |
| `addSongTranslationAction(songId, lang)` | 554 | scaffolds a `.cho` for a language | RO only | edit, song, list, browse |
| `removeSongTranslationAction(songId, lang, currentLang)` | 577 | deletes a translation; returns remaining | RO only | five paths |

## Albums and artists

| Action | Line | Does | Role check | Revalidates |
| --- | --- | --- | --- | --- |
| `changeAlbumIdAction(oldId, newId)` | 507 | `renameAlbum` (folder move) | RO → `READ_ONLY`; **no role check** | album, list, songs, browse |
| `changeSongAlbumAction(songId, albumId)` | 531 | moves song between albums | RO → `READ_ONLY`; **no role check** | song, both album, songs, browse |

## Partitions

| Action | Line | Does | Role check |
| --- | --- | --- | --- |
| `scanPartitionsAction()` | 614 | scans the partitions dir, matches PDFs to songs by title | RO only |
| `applyPartitionsAction(songId, partitions[])` | 633 | writes `meta.partitions` | RO only; revalidates song/list/admin |
| `applyAllPartitionsAction(matches)` | 658 | bulk apply | RO only |

## Setlists

| Action | Line | Guard | Revalidates |
| --- | --- | --- | --- |
| `generateSetlistVoiceSharesAction(setlistId)` | 690 | `canCreateSetlist` + owner or `canEdit` | `/setlists/[id]`, `/setlists` |
| `setSetlistPublicAction(setlistId, isPublic)` | 732 | `canManageSetlistShares` + owner or `canEdit` | same two |
| `createSetlistShareAction(setlistId)` | 763 | same as public toggle | same two |
| `deleteSetlistShareAction(setlistId)` | 794 | same | same two |
| `setSetlistShareSlugAction(setlistId, slug)` | 827 | same; slug pattern `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,59}$`, uniqueness checked | same two |

Setlist actions run in read-only mode (that is the point). The editor's setlist create/update
(`saveSetlist`, exported from `src/lib/content`) is called through the setlist page/editor rather
than as an action; the API routes in `src/app/api/setlists/` cover it as well.

## Notes

- **Most actions enforce only read-only mode.** They do not re-check the caller's role beyond the
  page that already gated the route. The exceptions are publishing, bulk import, revisions, and the
  setlist share/voice actions, which check explicitly.
- **Publishing a translation is admin-only.** `toggleSongPublishedAction` returns
  `{ok:false, error:'Admin required'}`; `publishRevisionAction` allows editors.
- **`revalidatePath` is the caching contract.** Actions that change a song revalidate the song,
  edit, list, and browse paths so the Next.js cache is invalidated. If you add an action, mirror the
  revalidation of the nearest existing action.
- Several actions move folders (`changeSongIdAction`, `changeAlbumIdAction`,
  `changeSongAlbumAction`) without a role check beyond read-only mode, matching the API inconsistency.