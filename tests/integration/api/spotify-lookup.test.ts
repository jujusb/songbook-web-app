import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/spotify/lookup/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { createSong, createAlbum } from '@/lib/content';
import { getSpotifyConfig } from '@/lib/spotify/config';
import { searchSpotify } from '@/lib/spotify/api';

vi.mock('@/lib/spotify/config', () => ({
  getSpotifyConfig: vi.fn(),
}));

vi.mock('@/lib/spotify/api', () => ({
  searchSpotify: vi.fn(),
}));

function createMockRequest(body?: unknown, raw?: () => Promise<unknown>) {
  return {
    method: 'POST',
    url: 'http://localhost/api/spotify/lookup',
    json: raw ?? (async () => body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/spotify/lookup', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    await createSong('song-1', 'Test Song', 'en');
    await createAlbum('album-1', 'Test Album', 'various-artists');
    vi.mocked(getSpotifyConfig).mockReturnValue({ clientId: 'id', clientSecret: 'secret' });
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns invalid_body for unparseable JSON', async () => {
    const res = await POST(createMockRequest(undefined, async () => {
      throw new Error('bad');
    }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'invalid_body' });
  });

  it('returns invalid_params for a bad type', async () => {
    const res = await POST(createMockRequest({ type: 'artist', id: 'x', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'invalid_params' });
  });

  it('returns invalid_params when id or lang is missing', async () => {
    const res = await POST(createMockRequest({ type: 'song', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'invalid_params' });
  });

  it('returns unconfigured when Spotify credentials are missing', async () => {
    vi.mocked(getSpotifyConfig).mockReturnValue(null);
    const res = await POST(createMockRequest({ type: 'song', id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'unconfigured' });
  });

  it('looks up a song track', async () => {
    const item = { id: 'track-1', url: 'https://open.spotify.com/track/track-1' };
    vi.mocked(searchSpotify).mockResolvedValueOnce(item);
    const res = await POST(createMockRequest({ type: 'song', id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, data: item });
    expect(searchSpotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'track', title: 'Test Song' })
    );
  });

  it('looks up an album', async () => {
    const item = { id: 'album-spot', url: 'https://open.spotify.com/album/album-spot' };
    vi.mocked(searchSpotify).mockResolvedValueOnce(item);
    const res = await POST(createMockRequest({ type: 'album', id: 'album-1', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, data: item });
    expect(searchSpotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'album', title: 'Test Album', artist: 'Various Artists' })
    );
  });

  it('returns data null when nothing matches', async () => {
    vi.mocked(searchSpotify).mockResolvedValueOnce(null);
    const res = await POST(createMockRequest({ type: 'song', id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: true, data: null });
  });

  it('returns search_failed when the search throws', async () => {
    vi.mocked(searchSpotify).mockRejectedValueOnce(new Error('upstream'));
    const res = await POST(createMockRequest({ type: 'song', id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'search_failed' });
  });

  it('returns search_failed when the album cannot be loaded', async () => {
    const res = await POST(createMockRequest({ type: 'album', id: 'missing-album', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'search_failed' });
  });
});
