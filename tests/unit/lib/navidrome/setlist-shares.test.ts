import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/lib/content', () => ({
  getSongTranslation: vi.fn(),
}));

vi.mock('@/lib/navidrome/voices', () => ({
  getVoiceTrackIdsForSetlist: vi.fn(),
  SECTION_ORDER: ['tenor', 'bass', 'alto', 'soprano'],
}));

import {
  generateSetlistVoiceShares,
  getSetlistVoiceShares,
} from '@/lib/navidrome/setlist-shares';
import { getVoiceTrackIdsForSetlist } from '@/lib/navidrome/voices';
import type { Setlist } from '@/lib/content/schemas';
import type { VoiceTrack } from '@/lib/navidrome/voices';

const VOICES_KEYS = [
  'SONGBOOK_VOICES_NAVIDROME_SONGS_URL',
  'SONGBOOK_VOICES_NAVIDROME_USERNAME',
  'SONGBOOK_VOICES_NAVIDROME_PASSWORD',
];

function jsonRes(body: Record<string, unknown>): { text: () => Promise<string> } {
  return { text: async () => JSON.stringify({ 'subsonic-response': body }) };
}

const mockGetVoiceTrackIds = getVoiceTrackIdsForSetlist as unknown as Mock;

function makeSetlist(overrides: Partial<Setlist> = {}): Setlist {
  return {
    id: 'setlist-1',
    title: 'Sunday Service',
    songs: [{ songId: 's1', lang: 'en' }],
    voiceShares: [],
    public: false,
    ...overrides,
  } as Setlist;
}

describe('navidrome/setlist-shares', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.SONGBOOK_VOICES_NAVIDROME_SONGS_URL = 'https://voices.example.com';
    process.env.SONGBOOK_VOICES_NAVIDROME_USERNAME = 'user';
    process.env.SONGBOOK_VOICES_NAVIDROME_PASSWORD = 'secret';
    mockGetVoiceTrackIds.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of VOICES_KEYS) delete process.env[key];
  });

  function setupFetch(opts: {
    shares?: Record<string, unknown>[];
    created?: Record<string, unknown>;
    head?: (url: string) => unknown;
  }): void {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (method === 'HEAD') {
          return opts.head ? await opts.head(url) : { headers: new Headers() };
        }
        if (url.includes('getShares.view')) {
          return jsonRes({ status: 'ok', shares: { share: opts.shares ?? [] } });
        }
        if (url.includes('createShare.view')) {
          return jsonRes({
            status: 'ok',
            shares: { share: opts.created ? [opts.created] : [] },
          });
        }
        if (url.includes('deleteShare.view')) {
          return jsonRes({ status: 'ok' });
        }
        throw new Error('unexpected fetch: ' + url);
      }
    );
  }

  const part = (overrides: Partial<VoiceTrack> = {}): VoiceTrack => ({
    id: 't1',
    title: 'Track One',
    ...overrides,
  });

  describe('generateSetlistVoiceShares', () => {
    it('returns empty results when the voices instance is not configured', async () => {
      for (const key of VOICES_KEYS) delete process.env[key];
      const result = await generateSetlistVoiceShares(makeSetlist());
      expect(result).toEqual({ shares: [], enriched: [] });
      expect(mockGetVoiceTrackIds).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reuses an existing share whose playlist matches the tracks', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part({ coverArt: 'c1' })] });
      setupFetch({
        shares: [
          {
            id: 'sh1',
            url: 'http://voices.example.com/share/t',
            entry: [{ id: 't1', title: 'Track One' }],
          },
        ],
      });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-reuse' }));

      expect(result.shares).toEqual([
        {
          section: 'tenor',
          url: 'https://voices.example.com/share/t',
          count: 1,
          embeddable: true,
        },
      ]);
      expect(result.enriched[0].tracks[0].streamUrl).toContain('stream.view');
      expect(result.enriched[0].tracks[0].coverArtUrl).toContain('getCoverArt.view');
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes('createShare'))
      ).toBe(false);
    });

    it('creates a new multi-track share when none matches', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({
        tenor: [part({ id: 't1', title: 'A' }), part({ id: 't2', title: 'B' })],
      });
      setupFetch({
        shares: [],
        created: {
          id: 'new-sh',
          url: 'http://voices.example.com/share/new',
          entry: [
            { id: 't1', title: 'A' },
            { id: 't2', title: 'B' },
          ],
        },
      });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-create' }));

      expect(result.shares).toHaveLength(1);
      expect(result.shares[0].url).toBe('https://voices.example.com/share/new');
      const createCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('createShare')
      );
      expect(String(createCall?.[0])).toContain('id=t1');
      expect(String(createCall?.[0])).toContain('id=t2');
    });

    it('skips a section when creating the share fails', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({ shares: [], created: undefined });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-fail' }));
      expect(result).toEqual({ shares: [], enriched: [] });
    });

    it('deletes a stale share whose url no longer matches', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({
        shares: [
          {
            id: 'old1',
            url: 'https://old.example.com/share/old',
            entry: [],
          },
        ],
        created: { id: 'new1', url: 'http://voices.example.com/share/new', entry: [] },
      });

      const setlist = makeSetlist({
        id: 'sl-stale',
        voiceShares: [
          {
            section: 'tenor',
            url: 'https://old.example.com/share/old',
            count: 1,
            embeddable: true,
          },
        ],
      });

      const result = await generateSetlistVoiceShares(setlist);

      expect(result.shares[0].url).toBe('https://voices.example.com/share/new');
      const deleteCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('deleteShare')
      );
      expect(deleteCall).toBeDefined();
      expect(String(deleteCall?.[0])).toContain('id=old1');
    });

    it('deletes shares for sections that no longer have recordings', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({});
      setupFetch({
        shares: [
          {
            id: 'a1',
            url: 'https://voices.example.com/share/a',
            entry: [],
          },
        ],
      });

      const setlist = makeSetlist({
        id: 'sl-drop',
        voiceShares: [
          {
            section: 'alto',
            url: 'https://voices.example.com/share/a',
            count: 2,
            embeddable: true,
          },
        ],
      });

      const result = await generateSetlistVoiceShares(setlist);

      expect(result).toEqual({ shares: [], enriched: [] });
      const deleteCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes('deleteShare')
      );
      expect(String(deleteCall?.[0])).toContain('id=a1');
    });

    it('does not delete when the stale share is not on the server', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({
        shares: [],
        created: { id: 'new1', url: 'http://voices.example.com/share/new', entry: [] },
      });

      const setlist = makeSetlist({
        id: 'sl-nostale',
        voiceShares: [
          {
            section: 'tenor',
            url: 'https://gone.example.com/share/gone',
            count: 1,
            embeddable: true,
          },
        ],
      });

      await generateSetlistVoiceShares(setlist);
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes('deleteShare'))
      ).toBe(false);
    });

    it('marks shares as non-embeddable when X-Frame-Options is set', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({
        shares: [
          {
            id: 'sh1',
            url: 'http://voices.example.com/share/t',
            entry: [{ id: 't1', title: 'Track One' }],
          },
        ],
        head: () => ({ headers: new Headers({ 'x-frame-options': 'DENY' }) }),
      });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-xfo' }));
      expect(result.shares[0].embeddable).toBe(false);
    });

    it('marks shares as non-embeddable for a restrictive frame-ancestors CSP', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({
        shares: [
          {
            id: 'sh1',
            url: 'http://voices.example.com/share/t',
            entry: [{ id: 't1', title: 'Track One' }],
          },
        ],
        head: () => ({
          headers: new Headers({ 'content-security-policy': "frame-ancestors 'self'" }),
        }),
      });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-csp-self' }));
      expect(result.shares[0].embeddable).toBe(false);
    });

    it('marks shares as embeddable when frame-ancestors is a wildcard', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({
        shares: [
          {
            id: 'sh1',
            url: 'http://voices.example.com/share/t',
            entry: [{ id: 't1', title: 'Track One' }],
          },
        ],
        head: () => ({
          headers: new Headers({ 'content-security-policy': 'frame-ancestors *' }),
        }),
      });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-csp-star' }));
      expect(result.shares[0].embeddable).toBe(true);
    });

    it('marks shares as embeddable when frame-ancestors lists a URL', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({
        shares: [
          {
            id: 'sh1',
            url: 'http://voices.example.com/share/t',
            entry: [{ id: 't1', title: 'Track One' }],
          },
        ],
        head: () => ({
          headers: new Headers({
            'content-security-policy': 'frame-ancestors https://songbook.example.com',
          }),
        }),
      });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-csp-url' }));
      expect(result.shares[0].embeddable).toBe(true);
    });

    it('marks shares as non-embeddable when the HEAD request fails', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({ tenor: [part()] });
      setupFetch({
        shares: [
          {
            id: 'sh1',
            url: 'http://voices.example.com/share/t',
            entry: [{ id: 't1', title: 'Track One' }],
          },
        ],
        head: () => {
          throw new Error('connection refused');
        },
      });

      const result = await generateSetlistVoiceShares(makeSetlist({ id: 'sl-head-err' }));
      expect(result.shares[0].embeddable).toBe(false);
    });
  });

  describe('getSetlistVoiceShares', () => {
    it('returns [] when the setlist has no stored shares', async () => {
      expect(await getSetlistVoiceShares(makeSetlist({ id: 'sl-empty' }))).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('resolves stored shares into tracks with streaming URLs', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({
        tenor: [part({ id: 't1', title: 'Track One', coverArt: 'c1' })],
      });
      const setlist = makeSetlist({
        id: 'sl-resolve',
        voiceShares: [
          {
            section: 'tenor',
            url: 'https://voices.example.com/share/t',
            count: 1,
            embeddable: true,
          },
        ],
      });

      const result = await getSetlistVoiceShares(setlist);

      expect(result).toHaveLength(1);
      expect(result[0].section).toBe('tenor');
      expect(result[0].tracks).toEqual([
        {
          title: 'Track One',
          streamUrl: expect.stringContaining('stream.view'),
          coverArtUrl: expect.stringContaining('getCoverArt.view'),
        },
      ]);
    });

    it('returns stored shares with no tracks when the section has no parts', async () => {
      mockGetVoiceTrackIds.mockResolvedValue({});
      const setlist = makeSetlist({
        id: 'sl-noparts',
        voiceShares: [
          {
            section: 'bass',
            url: 'https://voices.example.com/share/b',
            count: 0,
            embeddable: true,
          },
        ],
      });

      const result = await getSetlistVoiceShares(setlist);
      expect(result).toEqual([
        {
          section: 'bass',
          url: 'https://voices.example.com/share/b',
          count: 0,
          embeddable: true,
          tracks: [],
        },
      ]);
    });
  });
});
