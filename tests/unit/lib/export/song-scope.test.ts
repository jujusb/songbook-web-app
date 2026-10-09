import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listSongs,
  listAlbums,
  getSong,
  getAlbum,
  getArtist,
  getAlbumsForArtist,
  getSetlist,
  getSiteConfig,
  getSongTitle,
} from '@/lib/content';
import {
  resolveScopeSongs,
  resolveSongDisplayTitle,
} from '@/lib/export/song-scope';

vi.mock('@/lib/content', () => ({
  listSongs: vi.fn(),
  listAlbums: vi.fn(),
  getSong: vi.fn(),
  getAlbum: vi.fn(),
  getArtist: vi.fn(),
  getAlbumsForArtist: vi.fn(),
  getSetlist: vi.fn(),
  getSiteConfig: vi.fn(),
  getSongTitle: vi.fn(),
}));

function song(id: string, title: string, extra: Record<string, unknown> = {}) {
  return { id, title, translations: [], choTitles: {}, ...extra };
}
function album(id: string, title: string, songs: string[]) {
  return { id, title, songs, artist: 'various-artists', tags: [], translations: [], choTitles: {} };
}

const mocked = {
  listSongs: vi.mocked(listSongs),
  listAlbums: vi.mocked(listAlbums),
  getSong: vi.mocked(getSong),
  getAlbum: vi.mocked(getAlbum),
  getArtist: vi.mocked(getArtist),
  getAlbumsForArtist: vi.mocked(getAlbumsForArtist),
  getSetlist: vi.mocked(getSetlist),
  getSiteConfig: vi.mocked(getSiteConfig),
  getSongTitle: vi.mocked(getSongTitle),
};

describe('export/song-scope.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.listSongs.mockResolvedValue([] as any);
    mocked.listAlbums.mockResolvedValue([] as any);
    mocked.getSong.mockResolvedValue(null as any);
    mocked.getAlbum.mockResolvedValue(null as any);
    mocked.getArtist.mockResolvedValue(null as any);
    mocked.getAlbumsForArtist.mockResolvedValue([] as any);
    mocked.getSetlist.mockResolvedValue(null as any);
    mocked.getSiteConfig.mockResolvedValue({ title: 'Test Book' } as any);
    mocked.getSongTitle.mockResolvedValue('' as any);
  });

  describe('song scope', () => {
    it('returns an empty placeholder without an id', async () => {
      const r = await resolveScopeSongs('song', null);
      expect(r).toEqual({ scope: 'song', id: null, title: 'Song', songs: [] });
    });

    it('uses the song from the global list', async () => {
      mocked.listSongs.mockResolvedValue([song('s1', 'Song One')] as any);
      const r = await resolveScopeSongs('song', 's1');
      expect(r.title).toBe('Song One');
      expect(r.songs).toEqual([{ songId: 's1', meta: expect.objectContaining({ id: 's1' }), lang: null }]);
    });

    it('falls back to getSong when not in the list', async () => {
      mocked.getSong.mockResolvedValue(song('s2', 'Song Two') as any);
      const r = await resolveScopeSongs('song', 's2');
      expect(r.title).toBe('Song Two');
      expect(r.songs[0].songId).toBe('s2');
    });

    it('returns the id as title when the song is unknown', async () => {
      mocked.getSong.mockRejectedValue(new Error('not found'));
      const r = await resolveScopeSongs('song', 'ghost');
      expect(r.title).toBe('ghost');
      expect(r.songs).toEqual([]);
    });
  });

  describe('album scope', () => {
    it('returns a placeholder without an id', async () => {
      const r = await resolveScopeSongs('album', null);
      expect(r.title).toBe('Album');
      expect(r.songs).toEqual([]);
    });

    it('returns the id when the album is missing', async () => {
      mocked.getAlbum.mockResolvedValue(null as any);
      const r = await resolveScopeSongs('album', 'missing');
      expect(r.title).toBe('missing');
    });

    it('includes all songs for admins with an album header', async () => {
      mocked.listSongs.mockResolvedValue([song('s1', 'Song 1'), song('s2', 'Song 2')] as any);
      mocked.getAlbum.mockResolvedValue(album('a1', 'Album 1', ['s1', 's2']) as any);

      const r = await resolveScopeSongs('album', 'a1', { role: 'admin' });
      expect(r.title).toBe('Album 1');
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a1', 's1', 's2']);
      expect((r.songs[0].meta as any).__isAlbumHeader).toBe(true);
    });

    it('filters to songs with any published translation', async () => {
      mocked.listSongs.mockResolvedValue([
        song('s1', 'Song 1', { published: { en: true } }),
        song('s2', 'Song 2', { published: { en: false } }),
      ] as any);
      mocked.getAlbum.mockResolvedValue(album('a1', 'Album 1', ['s1', 's2']) as any);

      const r = await resolveScopeSongs('album', 'a1', { role: 'public' });
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a1', 's1']);
    });

    it('filters by a specific language when provided', async () => {
      mocked.listSongs.mockResolvedValue([
        song('s1', 'Song 1', { published: { en: true, es: false } }),
        song('s2', 'Song 2', { published: { en: false, es: true } }),
      ] as any);
      mocked.getAlbum.mockResolvedValue(album('a1', 'Album 1', ['s1', 's2']) as any);

      const r = await resolveScopeSongs('album', 'a1', { role: 'public', lang: 'es' });
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a1', 's2']);
    });
  });

  describe('artist scope', () => {
    it('returns a placeholder without an id', async () => {
      const r = await resolveScopeSongs('artist', null);
      expect(r.title).toBe('Artist');
    });

    it('returns the id when the artist is missing', async () => {
      mocked.getArtist.mockRejectedValue(new Error('nope'));
      const r = await resolveScopeSongs('artist', 'ghost');
      expect(r.title).toBe('ghost');
    });

    it('groups songs by album, sorted by album id', async () => {
      mocked.listSongs.mockResolvedValue([song('s1', 'Song 1'), song('s2', 'Song 2')] as any);
      mocked.getArtist.mockResolvedValue({ id: 'ar1', name: 'Artist One' } as any);
      mocked.getAlbumsForArtist.mockResolvedValue([
        album('b', 'B Album', ['s1']),
        album('a', 'A Album', ['s2']),
      ] as any);

      const r = await resolveScopeSongs('artist', 'ar1', { role: 'admin' });
      expect(r.title).toBe('Artist One');
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a', 's2', '__album_b', 's1']);
    });

    it('drops unpublished songs for non-admins', async () => {
      mocked.listSongs.mockResolvedValue([
        song('s1', 'Song 1', { published: { en: true } }),
        song('s2', 'Song 2', { published: { en: false } }),
      ] as any);
      mocked.getArtist.mockResolvedValue({ id: 'ar1', name: 'Artist One' } as any);
      mocked.getAlbumsForArtist.mockResolvedValue([album('a', 'A Album', ['s1', 's2'])] as any);

      const r = await resolveScopeSongs('artist', 'ar1', { role: 'public' });
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a', 's1']);
    });
  });

  describe('setlist scope', () => {
    it('returns a placeholder without an id', async () => {
      expect((await resolveScopeSongs('setlist', null)).title).toBe('Setlist');
    });

    it('returns the id when the setlist is missing', async () => {
      mocked.getSetlist.mockRejectedValue(new Error('nope'));
      expect((await resolveScopeSongs('setlist', 'missing')).title).toBe('missing');
    });

    it('keeps every known song for admins', async () => {
      mocked.listSongs.mockResolvedValue([song('s1', 'Song 1'), song('s2', 'Song 2')] as any);
      mocked.getSetlist.mockResolvedValue({
        id: 'sl1',
        title: 'Sunday',
        songs: [
          { songId: 's1', lang: 'en' },
          { songId: 's2', lang: 'es' },
          { songId: 'missing', lang: 'en' },
        ],
      } as any);

      const r = await resolveScopeSongs('setlist', 'sl1', { role: 'admin' });
      expect(r.title).toBe('Sunday');
      expect(r.songs.map((s) => s.songId)).toEqual(['s1', 's2']);
      expect(r.songs[0].lang).toBe('en');
    });

    it('filters by the published status of each item language', async () => {
      mocked.listSongs.mockResolvedValue([
        song('s1', 'Song 1', { published: { en: true } }),
        song('s2', 'Song 2', { published: { es: false } }),
      ] as any);
      mocked.getSetlist.mockResolvedValue({
        id: 'sl1',
        title: 'Sunday',
        songs: [
          { songId: 's1', lang: 'en' },
          { songId: 's2', lang: 'es' },
        ],
      } as any);

      const r = await resolveScopeSongs('setlist', 'sl1', { role: 'public' });
      expect(r.songs.map((s) => s.songId)).toEqual(['s1']);
    });
  });

  describe('book / all scopes', () => {
    it('builds the book from published albums and uses the site title', async () => {
      mocked.listAlbums.mockResolvedValue([album('a1', 'Album 1', ['s1', 's2'])] as any);
      mocked.listSongs.mockResolvedValue([
        song('s1', 'Song 1', { published: { en: true } }),
        song('s2', 'Song 2', { published: { en: false } }),
      ] as any);

      const r = await resolveScopeSongs('book', null, { role: 'public' });
      expect(r.id).toBeNull();
      expect(r.title).toBe('Test Book');
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a1', 's1']);
    });

    it('falls back to "Songbook" when the config lookup fails', async () => {
      mocked.getSiteConfig.mockRejectedValue(new Error('no config'));
      mocked.listAlbums.mockResolvedValue([] as any);
      const r = await resolveScopeSongs('all', null, { role: 'public' });
      expect(r.title).toBe('Songbook');
    });

    it('falls back to "Songbook" when the configured title is empty', async () => {
      mocked.getSiteConfig.mockResolvedValue({ title: '' } as any);
      const r = await resolveScopeSongs('all', null, { role: 'public' });
      expect(r.title).toBe('Songbook');
    });

    it('includes unpublished songs for admins in all scope', async () => {
      mocked.listAlbums.mockResolvedValue([album('a1', 'Album 1', ['s1'])] as any);
      mocked.listSongs.mockResolvedValue([song('s1', 'Song 1', { published: { en: false } })] as any);
      const r = await resolveScopeSongs('all', null, { role: 'admin' });
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a1', 's1']);
    });

    it('filters by language in all scope', async () => {
      mocked.listAlbums.mockResolvedValue([album('a1', 'Album 1', ['s1', 's2'])] as any);
      mocked.listSongs.mockResolvedValue([
        song('s1', 'Song 1', { published: { es: true } }),
        song('s2', 'Song 2', { published: { es: false } }),
      ] as any);
      const r = await resolveScopeSongs('all', null, { role: 'public', lang: 'es' });
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a1', 's1']);
    });

    it('ignores album entries whose song is unknown', async () => {
      mocked.listAlbums.mockResolvedValue([album('a1', 'Album 1', ['ghost'])] as any);
      mocked.listSongs.mockResolvedValue([] as any);
      const r = await resolveScopeSongs('all', null, { role: 'admin' });
      expect(r.songs.map((s) => s.songId)).toEqual(['__album_a1']);
    });
  });

  describe('unknown scope', () => {
    it('returns a default Songbook result', async () => {
      const r = await resolveScopeSongs('nonsense' as any, 'x');
      expect(r).toEqual({ scope: 'nonsense', id: 'x', title: 'Songbook', songs: [] });
    });
  });

  describe('resolveSongDisplayTitle', () => {
    it('uses the localized title when available', async () => {
      mocked.getSongTitle.mockResolvedValue('Título' as any);
      expect(await resolveSongDisplayTitle('s1', 'es')).toBe('Título');
    });

    it('falls back to the meta title when the localized title is empty', async () => {
      mocked.getSongTitle.mockResolvedValue('' as any);
      mocked.getSong.mockResolvedValue(song('s1', 'Meta Title') as any);
      expect(await resolveSongDisplayTitle('s1', 'es')).toBe('Meta Title');
    });

    it('falls back to the meta title when the localized lookup throws', async () => {
      mocked.getSongTitle.mockRejectedValue(new Error('boom'));
      mocked.getSong.mockResolvedValue(song('s1', 'Meta Title') as any);
      expect(await resolveSongDisplayTitle('s1', 'es')).toBe('Meta Title');
    });

    it('does not look up a localized title without a language', async () => {
      mocked.getSong.mockResolvedValue(song('s1', 'Meta Title') as any);
      expect(await resolveSongDisplayTitle('s1', null)).toBe('Meta Title');
      expect(mocked.getSongTitle).not.toHaveBeenCalled();
    });

    it('returns the song id when the meta lookup fails', async () => {
      mocked.getSong.mockRejectedValue(new Error('nope'));
      expect(await resolveSongDisplayTitle('ghost', null)).toBe('ghost');
    });
  });
});
