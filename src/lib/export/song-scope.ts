import {
  listSongs,
  getSong,
  getAlbum,
  getArtist,
  getAlbumsForArtist,
  getSetlist,
  getSiteConfig,
  getSongTitle,
} from '@/lib/content';
import type { SongListItem } from '@/lib/content';
import type { SongMeta } from '@/lib/content/schemas';

export type ExportScope = 'song' | 'album' | 'artist' | 'setlist' | 'all';

export interface ResolvedScopeSong {
  songId: string;
  /** Song metadata (title, key, partitions, ...). */
  meta?: SongListItem | SongMeta | null;
  /** Setlist items carry an explicit language; other scopes use a `null` lang. */
  lang?: string | null;
}

export interface ResolvedScope {
  scope: ExportScope;
  id: string | null;
  title: string;
  songs: ResolvedScopeSong[];
}

function toResolved(
  scope: ExportScope,
  id: string | null,
  title: string,
  songs: ResolvedScopeSong[],
): ResolvedScope {
  return { scope, id, title, songs };
}

/**
 * Resolve a scope into its ordered list of songs. Used by the PDF export
 * page, the PDF API, and the partition (instrumental) export.
 */
export async function resolveScopeSongs(
  scope: ExportScope,
  id: string | null,
): Promise<ResolvedScope> {
  const allSongs = await listSongs();
  const allById = new Map(allSongs.map((s) => [s.id, s]));

  switch (scope) {
    case 'song': {
      if (!id) return toResolved(scope, id, 'Song', []);
      const meta = allById.get(id) ?? (await getSong(id).catch(() => null));
      if (!meta) return toResolved(scope, id, id, []);
      return toResolved(scope, id, meta.title, [{ songId: id, meta, lang: null }]);
    }
    case 'album': {
      if (!id) return toResolved(scope, id, 'Album', []);
      const album = await getAlbum(id).catch(() => null);
      if (!album) return toResolved(scope, id, id, []);
      const title = album.title ?? id;
      const songs = album.songs
        .map((songId) => ({ songId, meta: allById.get(songId) ?? null, lang: null }))
        .filter((s) => s.meta);
      return toResolved(scope, id, title, songs);
    }
    case 'artist': {
      if (!id) return toResolved(scope, id, 'Artist', []);
      const artist = await getArtist(id).catch(() => null);
      if (!artist) return toResolved(scope, id, id, []);
      const albums = await getAlbumsForArtist(id).catch(() => []);
      const seen = new Set<string>();
      const songs: ResolvedScopeSong[] = [];
      for (const album of albums) {
        for (const songId of album.songs) {
          if (seen.has(songId)) continue;
          seen.add(songId);
          songs.push({ songId, meta: allById.get(songId) ?? null, lang: null });
        }
      }
      return toResolved(scope, id, artist.name, songs.filter((s) => s.meta));
    }
    case 'setlist': {
      if (!id) return toResolved(scope, id, 'Setlist', []);
      const setlist = await getSetlist(id).catch(() => null);
      if (!setlist) return toResolved(scope, id, id, []);
      const songs: ResolvedScopeSong[] = setlist.songs
        .map((item) => ({
          songId: item.songId,
          meta: allById.get(item.songId) ?? null,
          lang: item.lang,
        }))
        .filter((s) => s.meta);
      return toResolved(scope, id, setlist.title, songs);
    }
    case 'all': {
      let title = 'Songbook';
      try {
        const config = await getSiteConfig();
        title = config.title || 'Songbook';
      } catch {}
      const sorted = [...allSongs].sort((a, b) => a.title.localeCompare(b.title));
      return toResolved(
        scope,
        null,
        title,
        sorted.map((s) => ({ songId: s.id, meta: s, lang: null })),
      );
    }
    default:
      return toResolved(scope, id, 'Songbook', []);
  }
}

/**
 * Resolve the display title of a single song for a given language, with
 * graceful fallbacks.
 */
export async function resolveSongDisplayTitle(
  songId: string,
  lang: string | null | undefined,
): Promise<string> {
  if (lang && songId) {
    const title = await getSongTitle(songId, lang).catch(() => '');
    if (title) return title;
  }
  const meta = await getSong(songId).catch(() => null);
  return meta?.title ?? songId;
}