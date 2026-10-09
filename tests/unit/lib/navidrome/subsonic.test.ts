import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubsonicClient } from '@/lib/navidrome/subsonic';
import type { NavidromeConfig } from '@/lib/navidrome/config';

function subsonicResponse(body: Record<string, unknown>): { text: () => Promise<string> } {
  return {
    text: async () => JSON.stringify({ 'subsonic-response': body }),
  };
}

const config: NavidromeConfig = {
  songsUrl: 'https://nav.example.com',
  username: 'user',
  password: 'pässword',
};

describe('navidrome/subsonic SubsonicClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: SubsonicClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new SubsonicClient(config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds authenticated request URLs with signed params', async () => {
    fetchMock.mockResolvedValueOnce(
      subsonicResponse({ status: 'ok', searchResult3: { song: [] } })
    );

    await client.search3({ query: 'hello world' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/rest/search3.view');
    expect(url).toContain('u=user');
    expect(url).toContain('t=');
    expect(url).toContain('s=');
    expect(url).toContain('query=hello+world');
    expect(url).toContain('v=1.16.1');
    expect(url).toContain('f=json');
  });

  describe('search3', () => {
    it('returns the searchResult3 payload and applies default counts', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({
          status: 'ok',
          searchResult3: { song: [{ id: 's1' }], album: [{ id: 'a1' }] },
        })
      );

      const res = await client.search3({ query: 'q' });

      expect(res.song).toEqual([{ id: 's1' }]);
      expect(res.album).toEqual([{ id: 'a1' }]);
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain('songCount=20');
      expect(url).toContain('albumCount=20');
      expect(url).toContain('artistCount=5');
    });

    it('honours explicit counts', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({ status: 'ok', searchResult3: {} })
      );

      await client.search3({ query: 'q', songCount: 3, albumCount: 4, artistCount: 2 });

      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain('songCount=3');
      expect(url).toContain('albumCount=4');
      expect(url).toContain('artistCount=2');
    });

    it('returns an empty object when searchResult3 is missing', async () => {
      fetchMock.mockResolvedValueOnce(subsonicResponse({ status: 'ok' }));
      expect(await client.search3({ query: 'q' })).toEqual({});
    });
  });

  describe('getAlbum', () => {
    it('returns the album payload', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({
          status: 'ok',
          album: { id: 'a1', name: 'Album', song: [{ id: 's1' }] },
        })
      );

      const album = await client.getAlbum('a1');

      expect(album.id).toBe('a1');
      expect(album.song).toEqual([{ id: 's1' }]);
      expect(String(fetchMock.mock.calls[0][0])).toContain('id=a1');
    });
  });

  describe('getAlbumList2', () => {
    it('returns albums and default size', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({
          status: 'ok',
          albumList2: { album: [{ id: 'a1' }, { id: 'a2' }] },
        })
      );

      const albums = await client.getAlbumList2({ type: 'alphabeticalByName' });

      expect(albums).toEqual([{ id: 'a1' }, { id: 'a2' }]);
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain('type=alphabeticalByName');
      expect(url).toContain('size=500');
    });

    it('returns [] when albumList2 is missing', async () => {
      fetchMock.mockResolvedValueOnce(subsonicResponse({ status: 'ok' }));
      expect(await client.getAlbumList2({ type: 'newest', size: 10 })).toEqual([]);
    });

    it('returns [] when album is missing', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({ status: 'ok', albumList2: {} })
      );
      expect(await client.getAlbumList2({ type: 'newest' })).toEqual([]);
    });
  });

  describe('getShares', () => {
    it('returns the shares list', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({
          status: 'ok',
          shares: { share: [{ id: 'sh1', url: 'https://nav/share/1' }] },
        })
      );

      const shares = await client.getShares();
      expect(shares).toEqual([{ id: 'sh1', url: 'https://nav/share/1' }]);
    });

    it('returns [] when shares are missing', async () => {
      fetchMock.mockResolvedValueOnce(subsonicResponse({ status: 'ok' }));
      expect(await client.getShares()).toEqual([]);
    });
  });

  describe('createShare', () => {
    it('returns the first created share', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({
          status: 'ok',
          shares: { share: [{ id: 'sh1', url: 'https://nav/share/1' }] },
        })
      );

      const share = await client.createShare(['s1', 's2'], 'desc', 123);

      expect(share.id).toBe('sh1');
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain('id=s1');
      expect(url).toContain('id=s2');
      expect(url).toContain('description=desc');
      expect(url).toContain('expires=123');
    });

    it('omits expires when falsy', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({ status: 'ok', shares: { share: [{ id: 'sh1' }] } })
      );

      await client.createShare('s1');

      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).not.toContain('expires');
    });

    it('throws when no share is returned', async () => {
      fetchMock.mockResolvedValueOnce(
        subsonicResponse({ status: 'ok', shares: { share: [] } })
      );

      await expect(client.createShare('s1')).rejects.toThrow(
        'Navidrome createShare returned no share'
      );
    });
  });

  describe('deleteShare', () => {
    it('calls the deleteShare endpoint', async () => {
      fetchMock.mockResolvedValueOnce(subsonicResponse({ status: 'ok' }));

      await client.deleteShare('sh1');

      expect(String(fetchMock.mock.calls[0][0])).toContain('/rest/deleteShare.view');
      expect(String(fetchMock.mock.calls[0][0])).toContain('id=sh1');
    });
  });

  describe('streamUrl and coverArtUrl', () => {
    it('builds a stream URL without a network call', async () => {
      const url = await client.streamUrl('track1');
      expect(url).toContain('/rest/stream.view');
      expect(url).toContain('id=track1');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('builds a cover art URL with the requested size', async () => {
      const url = await client.coverArtUrl('cover1', 128);
      expect(url).toContain('/rest/getCoverArt.view');
      expect(url).toContain('id=cover1');
      expect(url).toContain('size=128');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('uses the default cover art size of 512', async () => {
      const url = await client.coverArtUrl('cover1');
      expect(url).toContain('size=512');
    });
  });
});
