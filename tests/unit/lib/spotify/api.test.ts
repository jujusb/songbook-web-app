import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/spotify/config', () => ({
  getSpotifyConfig: vi.fn(),
}));

type FetchResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

const jsonRes = (data: unknown, status = 200): FetchResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

const CONFIG = { clientId: 'id', clientSecret: 'secret' };
const TOKEN = { access_token: 'test-token', expires_in: 3600 };

function spotifyItem(name: string, id: string, artists: string[] = []) {
  return {
    name,
    id,
    external_urls: { spotify: `https://open.spotify.com/track/${id}` },
    artists: artists.map((n) => ({ name: n })),
  };
}

describe('spotify/api.ts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  async function load(config: typeof CONFIG | null) {
    const configModule = await import('@/lib/spotify/config');
    vi.mocked(configModule.getSpotifyConfig).mockReturnValue(config);
    return import('@/lib/spotify/api');
  }

  function routeFetch(search: unknown, token: unknown = TOKEN) {
    fetchMock.mockImplementation((input: unknown) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('accounts.spotify.com')) return Promise.resolve(jsonRes(token));
      return Promise.resolve(jsonRes(search));
    });
  }

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('throws when Spotify is not configured', async () => {
    const api = await load(null);
    await expect(
      api.searchSpotify({ query: 'x', type: 'track', title: 'x' }),
    ).rejects.toThrow('Spotify not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the token request fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({}, 401));
    const api = await load(CONFIG);
    await expect(
      api.searchSpotify({ query: 'x', type: 'track', title: 'x' }),
    ).rejects.toThrow('Spotify token request failed: 401');
  });

  it('throws when the search request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes(TOKEN))
      .mockResolvedValueOnce(jsonRes({}, 500));
    const api = await load(CONFIG);
    await expect(
      api.searchSpotify({ query: 'x', type: 'track', title: 'x' }),
    ).rejects.toThrow('Spotify search failed: 500');
  });

  it('returns the best matching track', async () => {
    routeFetch({
      tracks: {
        items: [
          spotifyItem('Something Else', 'a', ['Nobody']),
          spotifyItem('Amazing Grace', 'b', ['John Newton']),
        ],
      },
    });
    const api = await load(CONFIG);
    const result = await api.searchSpotify({
      query: 'Amazing Grace John Newton',
      type: 'track',
      title: 'Amazing Grace',
      artist: 'John Newton',
    });
    expect(result).toEqual({
      id: 'b',
      url: 'https://open.spotify.com/track/b',
    });
  });

  it('returns null when nothing matches well', async () => {
    routeFetch({ tracks: { items: [spotifyItem('Totally Different', 'a', ['Nobody'])] } });
    const api = await load(CONFIG);
    const result = await api.searchSpotify({
      query: 'Amazing Grace',
      type: 'track',
      title: 'Amazing Grace',
      artist: 'John Newton',
    });
    expect(result).toBeNull();
  });

  it('returns null when the response has no items', async () => {
    routeFetch({});
    const api = await load(CONFIG);
    expect(
      await api.searchSpotify({ query: 'x', type: 'track', title: 'x' }),
    ).toBeNull();
  });

  it('searches albums and returns the best match', async () => {
    routeFetch({
      albums: { items: [spotifyItem('Worship Collection', 'alb', ['Various'])] },
    });
    const api = await load(CONFIG);
    const result = await api.searchSpotify({
      query: 'Worship',
      type: 'album',
      title: 'Worship Collection',
    });
    expect(result).toEqual({
      id: 'alb',
      url: 'https://open.spotify.com/track/alb',
    });
  });

  it('prefers a full title match over a partial one', async () => {
    routeFetch({
      tracks: {
        items: [
          spotifyItem('Amazing', 'partial'),
          spotifyItem('Amazing Grace', 'exact'),
        ],
      },
    });
    const api = await load(CONFIG);
    const result = await api.searchSpotify({
      query: 'Amazing Grace',
      type: 'track',
      title: 'Amazing Grace',
    });
    expect(result?.id).toBe('exact');
  });

  it('breaks title ties in favour of a matching artist', async () => {
    routeFetch({
      tracks: {
        items: [
          spotifyItem('Amazing Grace', 'wrong', ['Some Choir']),
          spotifyItem('Amazing Grace', 'right', ['John Newton']),
        ],
      },
    });
    const api = await load(CONFIG);
    const result = await api.searchSpotify({
      query: 'Amazing Grace',
      type: 'track',
      title: 'Amazing Grace',
      artist: 'John Newton',
    });
    expect(result?.id).toBe('right');
  });

  it('caches the access token across searches', async () => {
    routeFetch({ tracks: { items: [spotifyItem('Song', 's', ['A'])] } });
    const api = await load(CONFIG);

    await api.searchSpotify({ query: 'Song', type: 'track', title: 'Song', artist: 'A' });
    await api.searchSpotify({ query: 'Song', type: 'track', title: 'Song', artist: 'A' });

    const tokenCalls = fetchMock.mock.calls.filter((call) => {
      const url = typeof call[0] === 'string' ? call[0] : String(call[0]);
      return url.includes('accounts.spotify.com');
    });
    expect(tokenCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
