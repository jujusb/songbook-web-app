import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/navidrome/share/route';
import { getNavidromeConfig } from '@/lib/navidrome/config';
import { getSongShare, getAlbumShare } from '@/lib/navidrome/share';

vi.mock('@/lib/navidrome/config', () => ({
  getNavidromeConfig: vi.fn(),
}));

vi.mock('@/lib/navidrome/share', () => ({
  getSongShare: vi.fn(),
  getAlbumShare: vi.fn(),
}));

function createMockRequest(body?: unknown, raw?: () => Promise<unknown>) {
  return {
    method: 'POST',
    url: 'http://localhost/api/navidrome/share',
    json: raw ?? (async () => body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

const configured = { songsUrl: 'https://nav.example.com', username: 'u', password: 'p' };

describe('API /api/navidrome/share', () => {
  beforeEach(() => {
    vi.mocked(getNavidromeConfig).mockReturnValue(configured);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 invalid_body for unparseable JSON', async () => {
    const res = await POST(createMockRequest(undefined, async () => {
      throw new Error('bad');
    }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data).toEqual({ ok: false, error: 'invalid_body' });
  });

  it('returns 400 invalid_params for a bad type', async () => {
    const res = await POST(createMockRequest({ type: 'playlist', id: 'x', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data).toEqual({ ok: false, error: 'invalid_params' });
  });

  it('returns 400 invalid_params when id or lang is missing', async () => {
    const res = await POST(createMockRequest({ type: 'song', id: 'x' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data).toEqual({ ok: false, error: 'invalid_params' });
  });

  it('returns 400 unconfigured when Navidrome is not set up', async () => {
    vi.mocked(getNavidromeConfig).mockReturnValue(null);
    const res = await POST(createMockRequest({ type: 'song', id: 'x', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data).toEqual({ ok: false, error: 'unconfigured' });
  });

  it('returns a song share', async () => {
    const share = { url: 'https://nav.example.com/share/1', songTitle: 'Song' };
    vi.mocked(getSongShare).mockResolvedValueOnce(share as any);
    const res = await POST(createMockRequest({ type: 'song', id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, data: share });
    expect(getSongShare).toHaveBeenCalledWith('song-1', 'en');
  });

  it('returns an album share', async () => {
    const share = { url: 'https://nav.example.com/share/2', albumTitle: 'Album' };
    vi.mocked(getAlbumShare).mockResolvedValueOnce(share as any);
    const res = await POST(createMockRequest({ type: 'album', id: 'album-1', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, data: share });
    expect(getAlbumShare).toHaveBeenCalledWith('album-1', 'en');
  });

  it('returns 404 when a song share is not found', async () => {
    vi.mocked(getSongShare).mockResolvedValueOnce(null);
    const res = await POST(createMockRequest({ type: 'song', id: 'missing', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data).toEqual({ ok: false, error: 'not_found' });
  });

  it('returns 404 when an album share is not found', async () => {
    vi.mocked(getAlbumShare).mockResolvedValueOnce(null);
    const res = await POST(createMockRequest({ type: 'album', id: 'missing', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data).toEqual({ ok: false, error: 'not_found' });
  });
});
