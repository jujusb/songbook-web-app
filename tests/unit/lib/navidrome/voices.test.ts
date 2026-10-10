import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

vi.mock('@/lib/content', () => ({
  getAlbum: vi.fn(),
  getAlbumTitle: vi.fn(),
  getAlbumsForSong: vi.fn(),
  getArtist: vi.fn(),
  getArtistForSong: vi.fn(),
  getContentDir: vi.fn(),
  getSongTitle: vi.fn(),
}));

const VOICES_KEYS = [
  'SONGBOOK_VOICES_NAVIDROME_SONGS_URL',
  'SONGBOOK_VOICES_NAVIDROME_USERNAME',
  'SONGBOOK_VOICES_NAVIDROME_PASSWORD',
];
const VOICES_MATCHING_FILE = 'SONGBOOK_VOICES_MATCHING_FILE';

const tempDirs: string[] = [];

async function writeMatchingFile(json: string): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'songbook-voices-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, 'voices.json');
  await writeFile(filePath, json, 'utf-8');
  process.env[VOICES_MATCHING_FILE] = filePath;
}

function jsonRes(body: Record<string, unknown>): { text: () => Promise<string> } {
  return { text: async () => JSON.stringify({ 'subsonic-response': body }) };
}

type VoicesModule = typeof import('@/lib/navidrome/voices');
type ContentModule = typeof import('@/lib/content');

describe('navidrome/voices', () => {
  let voices: VoicesModule;
  let content: ContentModule;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.SONGBOOK_VOICES_NAVIDROME_SONGS_URL = 'https://voices.example.com';
    process.env.SONGBOOK_VOICES_NAVIDROME_USERNAME = 'user';
    process.env.SONGBOOK_VOICES_NAVIDROME_PASSWORD = 'secret';
    content = await import('@/lib/content');
    (content.getContentDir as unknown as Mock).mockReturnValue(
      '/nonexistent-songbook-content',
    );
    voices = await import('@/lib/navidrome/voices');
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    for (const key of VOICES_KEYS) delete process.env[key];
    delete process.env[VOICES_MATCHING_FILE];
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  const mockGetSongTitle = () => content.getSongTitle as unknown as Mock;

  function clearVoicesConfig(): void {
    for (const key of VOICES_KEYS) delete process.env[key];
  }

  describe('getVoiceSections', () => {
    it('returns [] when the voices instance is not configured', async () => {
      clearVoicesConfig();
      expect(await voices.getVoiceSections('s1', 'en')).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('groups matching recordings by gender and section', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: {
              song: [
                { id: 't1', title: 'Mi Cancion Tenor', coverArt: 'c1' },
                { id: 't2', title: 'Mi Cancion Chicos' },
                { id: 't3', title: 'Mi Cancion Chicas' },
                { id: 't4', title: 'Mi Cancion Soprano' },
                { id: 't5', title: 'Mi Cancion Chicos Alta' },
                { id: 't6', title: 'Otra Cancion Tenor' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const groups = await voices.getVoiceSections('song-1', 'es');

      expect(groups.map((g) => g.gender)).toEqual(['boys', 'girls']);
      const boys = groups.find((g) => g.gender === 'boys')!;
      const tenor = boys.sections.find((s) => s.section === 'tenor')!;
      const bass = boys.sections.find((s) => s.section === 'bass')!;
      expect(tenor.parts.map((p) => p.title).sort()).toEqual(
        ['Mi Cancion Chicos Alta', 'Mi Cancion Chicos', 'Mi Cancion Tenor'].sort()
      );
      expect(bass.parts.map((p) => p.title)).toEqual(['Mi Cancion Chicos']);
      expect(tenor.parts[0].streamUrl).toContain('stream.view');
      expect(tenor.parts.find((p) => p.title === 'Mi Cancion Tenor')?.coverArtUrl).toContain(
        'getCoverArt.view'
      );

      const girls = groups.find((g) => g.gender === 'girls')!;
      expect(girls.sections.find((s) => s.section === 'soprano')!.parts.map((p) => p.title).sort()).toEqual(
        ['Mi Cancion Chicas', 'Mi Cancion Soprano'].sort()
      );
      expect(girls.sections.find((s) => s.section === 'alto')!.parts.map((p) => p.title)).toEqual([
        'Mi Cancion Chicas',
      ]);
    });

    it('deduplicates recordings by normalized title', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: {
              song: [
                { id: 'a', title: 'Mi Cancion Tenor' },
                { id: 'b', title: 'mi cancion  tenor' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const groups = await voices.getVoiceSections('song-dup', 'es');
      const tenor = groups[0].sections.find((s) => s.section === 'tenor')!;
      expect(tenor.parts).toHaveLength(1);
    });

    it('supports singular labels for es, mapping chico/chica alta/baja', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: {
              song: [
                { id: 't1', title: 'Mi Cancion Chico Alta' },
                { id: 't2', title: 'Mi Cancion Chico Baja' },
                { id: 't3', title: 'Mi Cancion Chica Baja' },
                { id: 't4', title: 'Mi Cancion Chica Alta' },
                { id: 't5', title: 'Mi Cancion Chico' },
                { id: 't6', title: 'Mi Cancion Chica' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const groups = await voices.getVoiceSections('song-singular', 'es');
      const tenor = groups.find((g) => g.gender === 'boys')!.sections.find((s) => s.section === 'tenor')!;
      const bass = groups.find((g) => g.gender === 'boys')!.sections.find((s) => s.section === 'bass')!;
      const alto = groups.find((g) => g.gender === 'girls')!.sections.find((s) => s.section === 'alto')!;
      const soprano = groups.find((g) => g.gender === 'girls')!.sections.find((s) => s.section === 'soprano')!;
      expect(tenor.parts.map((p) => p.title).sort()).toEqual(
        ['Mi Cancion Chico Alta', 'Mi Cancion Chico'].sort()
      );
      expect(bass.parts.map((p) => p.title).sort()).toEqual(
        ['Mi Cancion Chico Baja', 'Mi Cancion Chico'].sort()
      );
      expect(alto.parts.map((p) => p.title).sort()).toEqual(
        ['Mi Cancion Chica Baja', 'Mi Cancion Chica'].sort()
      );
      expect(soprano.parts.map((p) => p.title).sort()).toEqual(
        ['Mi Cancion Chica Alta', 'Mi Cancion Chica'].sort()
      );
    });

    it('does not match chico/chica labels for en, but matches English keywords', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: {
              song: [
                { id: 't1', title: 'Mi Cancion Chicos' },
                { id: 't2', title: 'Mi Cancion Boys' },
                { id: 't3', title: 'Mi Cancion Girl' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const groups = await voices.getVoiceSections('song-en', 'en');
      const boys = groups.find((g) => g.gender === 'boys')!;
      const tenor = boys.sections.find((s) => s.section === 'tenor')!;
      expect(tenor.parts.map((p) => p.title)).toEqual(['Mi Cancion Boys']);
      const bass = boys.sections.find((s) => s.section === 'bass')!;
      expect(bass.parts).toHaveLength(0);
      const girls = groups.find((g) => g.gender === 'girls')!;
      expect(girls.sections.find((s) => s.section === 'alto')!.parts.map((p) => p.title)).toEqual([
        'Mi Cancion Girl',
      ]);
    });

    it('matches the universal boys/Girl words in any language', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: {
              song: [
                { id: 't1', title: 'Mi Cancion Boy' },
                { id: 't2', title: 'Mi Cancion Girl' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const groups = await voices.getVoiceSections('song-universal', 'en');
      expect(groups.map((g) => g.gender)).toEqual(['boys', 'girls']);
      const boys = groups.find((g) => g.gender === 'boys')!;
      expect(
        boys.sections.find((s) => s.section === 'tenor')!.parts.map((p) => p.title),
      ).toEqual(['Mi Cancion Boy']);
      expect(
        boys.sections.find((s) => s.section === 'bass')!.parts.map((p) => p.title),
      ).toEqual(['Mi Cancion Boy']);
      const girls = groups.find((g) => g.gender === 'girls')!;
      expect(
        girls.sections.find((s) => s.section === 'alto')!.parts.map((p) => p.title),
      ).toEqual(['Mi Cancion Girl']);
      expect(
        girls.sections.find((s) => s.section === 'soprano')!.parts.map((p) => p.title),
      ).toEqual(['Mi Cancion Girl']);
    });

    it('ignores recordings whose title does not contain the song title', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { song: [{ id: 'x', title: 'Cancion Diferente Tenor' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await voices.getVoiceSections('song-nomatch', 'en')).toEqual([]);
    });

    it('handles tracks without a title', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('search3.view')) {
          return jsonRes({
            status: 'ok',
            searchResult3: { song: [{ id: 'n' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await voices.getVoiceSections('song-notitle', 'en')).toEqual([]);
    });

    it('returns [] when the content lookup throws', async () => {
      mockGetSongTitle().mockRejectedValue(new Error('boom'));
      expect(await voices.getVoiceSections('song-err', 'en')).toEqual([]);
    });
  });

  describe('getAllVoiceTracks', () => {
    it('returns [] when not configured', async () => {
      clearVoicesConfig();
      expect(await voices.getAllVoiceTracks()).toEqual([]);
    });

    it('flattens album details, deduplicates and skips unreadable albums', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({
            status: 'ok',
            albumList2: { album: [{ id: 'a1' }, { id: 'a2' }] },
          });
        }
        if (url.includes('getAlbum.view') && url.includes('id=a1')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'a1',
              song: [
                { id: 's1', title: 'Track One', coverArt: 'c1' },
                { id: 's1', title: 'Track One' },
                { title: 'No Id' },
              ],
            },
          });
        }
        if (url.includes('getAlbum.view')) {
          throw new Error('unreadable album');
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const tracks = await voices.getAllVoiceTracks();

      expect(tracks).toEqual([{ id: 's1', title: 'Track One', coverArt: 'c1' }]);
    });

    it('returns [] when the album list fails', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      expect(await voices.getAllVoiceTracks()).toEqual([]);
    });
  });

  describe('getAllVoiceTrackTitles', () => {
    it('returns unique titles from the voice dump', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'a1',
              song: [
                { id: 's1', title: 'Same' },
                { id: 's2', title: 'Same' },
                { id: 's3', title: 'Other' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await voices.getAllVoiceTrackTitles()).toEqual(['Same', 'Other']);
    });
  });

  describe('getVoiceTrackIdsForSetlist', () => {
    it('returns {} when not configured', async () => {
      clearVoicesConfig();
      expect(await voices.getVoiceTrackIdsForSetlist([{ songId: 's1', lang: 'en' }])).toEqual({});
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns {} when there are no items', async () => {
      expect(await voices.getVoiceTrackIdsForSetlist([])).toEqual({});
    });

    it('returns {} when the voice dump is empty', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [] } });
        }
        throw new Error('unexpected fetch: ' + url);
      });
      expect(await voices.getVoiceTrackIdsForSetlist([{ songId: 's1', lang: 'en' }])).toEqual({});
    });

    it('maps tracks into each matching section', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'a1',
              song: [
                { id: 't1', title: 'Mi Cancion Tenor' },
                { id: 't2', title: 'Mi Cancion Chicos' },
                { id: 't3', title: 'Otra Cancion' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.getVoiceTrackIdsForSetlist([{ songId: 's1', lang: 'es' }]);

      expect(result.tenor?.map((t) => t.id)).toEqual(['t1', 't2']);
      expect(result.bass?.map((t) => t.id)).toEqual(['t2']);
      expect(result.alto).toBeUndefined();
    });

    it('uses each setlist item language for matching', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'a1',
              song: [
                { id: 't1', title: 'Mi Cancion Chicos' },
                { id: 't2', title: 'Mi Cancion Boys' },
                { id: 't3', title: 'Mi Cancion Basse' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.getVoiceTrackIdsForSetlist([
        { songId: 's1', lang: 'es' },
        { songId: 's2', lang: 'en' },
        { songId: 's3', lang: 'fr' },
      ]);

      expect(result.tenor?.map((t) => t.id)).toEqual(['t1', 't2']);
      expect(result.bass?.map((t) => t.id)).toEqual(['t1', 't3']);
    });

    it('never lists the same normalized title twice within a section', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'a1',
              song: [
                { id: 't1', title: 'Mi Cancion Tenor' },
                { id: 'z1', title: 'mi cancion tenor' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.getVoiceTrackIdsForSetlist([{ songId: 's1', lang: 'en' }]);
      expect(result.tenor).toHaveLength(1);
    });

    it('skips items whose song title cannot be read', async () => {
      mockGetSongTitle()
        .mockRejectedValueOnce(new Error('missing'))
        .mockResolvedValueOnce('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'a1', song: [{ id: 't1', title: 'Mi Cancion Tenor' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.getVoiceTrackIdsForSetlist([
        { songId: 'missing', lang: 'en' },
        { songId: 'ok', lang: 'en' },
      ]);
      expect(result.tenor?.map((t) => t.id)).toEqual(['t1']);
    });

    it('skips items with an empty normalized title', async () => {
      mockGetSongTitle().mockResolvedValue('!!!');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'a1', song: [{ id: 't1', title: 'Anything Tenor' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await voices.getVoiceTrackIdsForSetlist([{ songId: 's1', lang: 'en' }])).toEqual({});
    });

    it('reads the per-language vocabulary from the matching JSON file', async () => {
      await writeMatchingFile(
        JSON.stringify({
          matching: {
            de: {
              specific: { 'fuer stimme': 'tenor' },
              Boy: ['jungs'],
              Girl: ['maedchen'],
              keywords: { lead: 'tenor' },
            },
          },
        }),
      );
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'a1',
              song: [
                { id: 't1', title: 'Mi Cancion Jungs' },
                { id: 't2', title: 'Mi Cancion Maedchen' },
                { id: 't3', title: 'Mi Cancion Lead' },
                { id: 't4', title: 'Mi Cancion Chicos' },
                { id: 't5', title: 'Mi Cancion Boy' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.getVoiceTrackIdsForSetlist([
        { songId: 's1', lang: 'de' },
      ]);

      expect(result.tenor?.map((t) => t.id)).toEqual(['t1', 't3', 't5']);
      expect(result.bass?.map((t) => t.id)).toEqual(['t1', 't5']);
      expect(result.alto?.map((t) => t.id)).toEqual(['t2']);
      expect(result.soprano?.map((t) => t.id)).toEqual(['t2']);
    });

    it('keeps built-in defaults for dimensions the JSON file does not touch', async () => {
      await writeMatchingFile(
        JSON.stringify({
          matching: {
            es: { keywords: { bajo: 'bass' } },
          },
        }),
      );
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: {
              id: 'a1',
              song: [
                { id: 't1', title: 'Mi Cancion Bajo' },
                { id: 't2', title: 'Mi Cancion Chicos' },
                { id: 't3', title: 'Mi Cancion Tenor' },
              ],
            },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.getVoiceTrackIdsForSetlist([
        { songId: 's1', lang: 'es' },
      ]);

      expect(result.bass?.map((t) => t.id)).toEqual(['t1', 't2']);
      expect(result.tenor?.map((t) => t.id)).toEqual(['t2', 't3']);
    });

    it('ignores a malformed matching JSON file and uses the built-ins', async () => {
      await writeMatchingFile('{ not valid json');
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'a1', song: [{ id: 't1', title: 'Mi Cancion Chicos' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.getVoiceTrackIdsForSetlist([
        { songId: 's1', lang: 'es' },
      ]);

      expect(result.tenor?.map((t) => t.id)).toEqual(['t1']);
      expect(result.bass?.map((t) => t.id)).toEqual(['t1']);
    });
  });

  describe('hasVoiceSections', () => {
    it('returns false when not configured', async () => {
      clearVoicesConfig();
      expect(await voices.hasVoiceSections('s1', 'en')).toBe(false);
    });

    it('returns true when a recording matches', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'a1', song: [{ id: 't1', title: 'Mi Cancion Tenor' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await voices.hasVoiceSections('s1', 'en')).toBe(true);
    });

    it('returns false when no recording matches', async () => {
      mockGetSongTitle().mockResolvedValue('Mi Cancion');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'a1', song: [{ id: 't1', title: 'Otra Cancion Tenor' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      expect(await voices.hasVoiceSections('s1', 'en')).toBe(false);
    });

    it('returns false for an empty normalized title', async () => {
      mockGetSongTitle().mockResolvedValue('!!!');
      expect(await voices.hasVoiceSections('s1', 'en')).toBe(false);
    });

    it('returns false when the content lookup throws', async () => {
      mockGetSongTitle().mockRejectedValue(new Error('boom'));
      expect(await voices.hasVoiceSections('s1', 'en')).toBe(false);
    });
  });

  describe('hasVoiceSectionsBatch', () => {
    it('maps every song to false when not configured', async () => {
      clearVoicesConfig();
      const result = await voices.hasVoiceSectionsBatch(['s1', 's2'], 'en');
      expect(result.get('s1')).toBe(false);
      expect(result.get('s2')).toBe(false);
    });

    it('checks each song against the voice dump', async () => {
      mockGetSongTitle().mockImplementation(async (id: string) => {
        if (id === 's1') return 'Mi Cancion';
        if (id === 's2') return 'Otra Cancion';
        return '!!!';
      });
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'a1', song: [{ id: 't1', title: 'Mi Cancion Tenor' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.hasVoiceSectionsBatch(['s1', 's2', 's3'], 'en');
      expect(result.get('s1')).toBe(true);
      expect(result.get('s2')).toBe(false);
      expect(result.get('s3')).toBe(false);
    });

    it('treats songs whose title lookup throws as false', async () => {
      mockGetSongTitle().mockRejectedValue(new Error('missing'));
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('getAlbumList2.view')) {
          return jsonRes({ status: 'ok', albumList2: { album: [{ id: 'a1' }] } });
        }
        if (url.includes('getAlbum.view')) {
          return jsonRes({
            status: 'ok',
            album: { id: 'a1', song: [{ id: 't1', title: 'Mi Cancion Tenor' }] },
          });
        }
        throw new Error('unexpected fetch: ' + url);
      });

      const result = await voices.hasVoiceSectionsBatch(['s1'], 'en');
      expect(result.get('s1')).toBe(false);
    });
  });
});
