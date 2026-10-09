import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/content', () => ({
  getAlbum: vi.fn(),
  getAlbumTitle: vi.fn(),
  getAlbumsForSong: vi.fn(),
  getArtist: vi.fn(),
  getArtistForSong: vi.fn(),
  getSongTitle: vi.fn(),
}));

import {
  getSongShare,
  getAlbumShare,
  normalizeTitle,
} from '@/lib/navidrome/share';
import {
  getAlbum,
  getAlbumTitle,
  getAlbumsForSong,
  getArtist,
  getArtistForSong,
  getSongTitle,
} from '@/lib/content';

const NAV_KEYS = [
  'SONGBOOK_NAVIDROME_SONGS_URL',
  'SONGBOOK_NAVIDROME_USERNAME',
  'SONGBOOK_NAVIDROME_PASSWORD',
];

function jsonRes(body: Record<string, unknown>): { text: () => Promise<string> } {
  return { text: async () => JSON.stringify({ 'subsonic-response': body }) };
}

const mockGetAlbum = getAlbum as unknown as Mock;
const mockGetAlbumTitle = getAlbumTitle as unknown as Mock;
const mockGetAlbumsForSong = getAlbumsForSong as unknown as Mock;
const mockGetArtist = getArtist as unknown as Mock;
const mockGetArtistForSong = getArtistForSong as unknown as Mock;
const mockGetSongTitle = getSongTitle as unknown as Mock;

describe('navidrome/share', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.SONGBOOK_NAVIDROME_SONGS_URL = 'https://nav.example.com';
    process.env.SONGBOOK_NAVIDROME_USERNAME = 'user';
    process.env.SONGBOOK_NAVIDROME_PASSWORD = 'secret';

    mockGetSongTitle.mockResolvedValue('Amazing Grace');
    mockGetAlbumsForSong.mockResolvedValue([{ id: 'al1' }]);
    mockGetAlbumTitle.mockResolvedValue('Hymns');
    mockGetArtistForSong.mockResolvedValue({ name: 'John' });
    mockGetAlbum.mockResolvedValue({ id: 'album-1', artist: 'ar1', name: 'Album One' });
    mockGetArtist.mockResolvedValue({ name: 'John' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of NAV_KEYS) delete process.env[key];
  });

  describe('normalizeTitle', () => {
    it('lowercases and strips accents and punctuation', () => {
      expect(normalizeTitle('Cántico  Nuevo!')).toBe('cantico nuevo');
    });

    it('collapses whitespace and trims', () => {
      expect(normalizeTitle('  Hello --- World  ')).toBe('hello world');
    });

    it('returns an empty string for punctuation-only input', () => {
      expect(normalizeTitle('!!!')).toBe('');
    });
  });

  describe('getSongShare', () => {
    it('returns null when navidrome is not configured', async () => {
      delete process.env.SONGBOOK_NAVIDROME_SONGS_URL;
      expect(await getSongShare('song-nocfg', 'en')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('resolves the track inside the matched album and returns a share', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { album: [{ id: 'al1', name: 'Hymns', artist: 'John' }] },
          });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'al1',
              name: 'Hymns',
              artist: 'John',
              coverArt: 'cov',
              song: [
                {
                  id: 's1',
                  title: 'Amazing Grace',
                  artist: 'John',
                  albumId: 'al1',
                  coverArt: 'cov',
                },
              ],
            },
          });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({ status: 'ok', shares: { share: [] } });
        }
        if (url.includes('createShare.view')) {
          return jsonRes({
            status: 'ok',
            shares: { share: [{ id: 'sh1', url: 'http://nav.example.com/share/abc' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await getSongShare('song-happy', 'en');

      expect(result).toEqual({
        url: 'http://nav.example.com/share/abc',
        songTitle: 'Amazing Grace',
        albumTitle: 'Hymns',
        artist: 'John',
        streamUrl: expect.stringContaining('stream.view'),
        coverArtUrl: expect.stringContaining('getCoverArt.view'),
      });
    });

    it('falls back to song search when album detail cannot be read', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view') && url.includes('query=Hymns')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { album: [{ id: 'al1', name: 'Hymns', artist: 'John' }] },
          });
        }
        if (url.includes('getAlbum.view')) {
          throw new Error('album unavailable');
        }
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: {
              song: [
                {
                  id: 's9',
                  title: 'Amazing Grace',
                  artist: 'John',
                  albumId: 'al1',
                  coverArt: 'c9',
                },
              ],
            },
          });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({ status: 'ok', shares: { share: [] } });
        }
        if (url.includes('createShare.view')) {
          return jsonRes({
            status: 'ok',
            shares: { share: [{ id: 'sh9', url: 'http://nav/share/9' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await getSongShare('song-fallback', 'en');

      expect(result?.url).toBe('http://nav/share/9');
      expect(result?.songTitle).toBe('Amazing Grace');
    });

    it('reuses an existing share that already contains the track', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { album: [{ id: 'al1', name: 'Hymns', artist: 'John' }] },
          });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'al1',
              name: 'Hymns',
              artist: 'John',
              song: [{ id: 's1', title: 'Amazing Grace', artist: 'John', albumId: 'al1' }],
            },
          });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({
            status: 'ok',
            shares: {
              share: [
                { id: 'existing', url: 'http://nav/share/existing', entry: [{ id: 's1' }] },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await getSongShare('song-reuse', 'en');

      expect(result?.url).toBe('http://nav/share/existing');
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('createShare'))).toBe(
        false
      );
    });

    it('returns null when no matching track is found', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({ status: 'ok', searchResult3: { album: [], song: [] } });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({ status: 'ok', shares: { share: [] } });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await getSongShare('song-none', 'en')).toBeNull();
    });

    it('returns null when content lookup throws', async () => {
      mockGetSongTitle.mockRejectedValueOnce(new Error('boom'));
      expect(await getSongShare('song-err', 'en')).toBeNull();
    });

    it('memoizes results for the same song and language', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { album: [{ id: 'al1', name: 'Hymns', artist: 'John' }] },
          });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'al1',
              name: 'Hymns',
              artist: 'John',
              song: [{ id: 's1', title: 'Amazing Grace', artist: 'John', albumId: 'al1' }],
            },
          });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({ status: 'ok', shares: { share: [] } });
        }
        if (url.includes('createShare.view')) {
          return jsonRes({
            status: 'ok',
            shares: { share: [{ id: 'sh1', url: 'http://nav/share/memo' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const first = await getSongShare('song-memo', 'en');
      const callsAfterFirst = fetchMock.mock.calls.length;
      const second = await getSongShare('song-memo', 'en');

      expect(second).toEqual(first);
      expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  describe('getAlbumShare', () => {
    beforeEach(() => {
      mockGetAlbumTitle.mockResolvedValue('Album One');
    });

    it('returns null when navidrome is not configured', async () => {
      delete process.env.SONGBOOK_NAVIDROME_SONGS_URL;
      expect(await getAlbumShare('album-nocfg', 'en')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns the album share with cover art and track stream URLs', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: {
              album: [
                { id: 'nd-a1', name: 'Album One', artist: 'John', coverArt: 'cov' },
              ],
            },
          });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'nd-a1',
              name: 'Album One',
              song: [
                { id: 't1', title: 'Track One' },
                { id: 't2', title: 'Track Two' },
              ],
            },
          });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({
            status: 'ok',
            shares: {
              share: [
                { id: 'shA', url: 'http://nav/share/album', entry: [{ id: 'nd-a1' }] },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await getAlbumShare('album-happy', 'en');

      expect(result).toEqual({
        url: 'http://nav/share/album',
        albumTitle: 'Album One',
        artist: 'John',
        coverArtUrl: expect.stringContaining('getCoverArt.view'),
        songs: [
          { id: 't1', title: 'Track One', streamUrl: expect.stringContaining('stream.view') },
          { id: 't2', title: 'Track Two', streamUrl: expect.stringContaining('stream.view') },
        ],
      });
    });

    it('returns null when the album cannot be found on navidrome', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({ status: 'ok', searchResult3: { album: [] } });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await getAlbumShare('album-missing', 'en')).toBeNull();
    });

    it('tolerates a missing artist lookup', async () => {
      mockGetArtist.mockRejectedValueOnce(new Error('no artist'));
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { album: [{ id: 'nd-a1', name: 'Album One', artist: 'John' }] },
          });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({ status: 'ok', album: { id: 'nd-a1', name: 'Album One', song: [] } });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({
            status: 'ok',
            shares: { share: [{ id: 'shA', url: 'http://nav/share/x', entry: [{ id: 'nd-a1' }] }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await getAlbumShare('album-noartist', 'en');
      expect(result?.artist).toBe('John');
    });

    it('returns null when the album lookup throws', async () => {
      mockGetAlbum.mockRejectedValueOnce(new Error('boom'));
      expect(await getAlbumShare('album-err', 'en')).toBeNull();
    });

    it('returns stream URLs for every song in the album', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { album: [{ id: 'nd-a1', name: 'Album One', artist: 'John' }] },
          });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'nd-a1', name: 'Album One', song: [{ id: 't1', title: 'Track One' }] },
          });
        }
        if (url.includes('getShares.view')) {
          return jsonRes({
            status: 'ok',
            shares: { share: [{ id: 'shA', url: 'http://nav/share/x', entry: [{ id: 'nd-a1' }] }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await getAlbumShare('album-track-ok', 'en');
      expect(result?.songs).toHaveLength(1);
    });
  });
});
