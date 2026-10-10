import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/voices/route';
import { getVoicesConfig } from '@/lib/navidrome/config';
import { getVoiceSections } from '@/lib/navidrome/voices';

vi.mock('@/lib/navidrome/config', () => ({
  getVoicesConfig: vi.fn(),
}));

vi.mock('@/lib/navidrome/voices', () => ({
  getVoiceSections: vi.fn(),
}));

function createMockRequest(body?: unknown, raw?: () => Promise<unknown>) {
  return {
    method: 'POST',
    url: 'http://localhost/api/voices',
    json: raw ?? (async () => body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

const configured = { songsUrl: 'https://nav.example.com', username: 'u', password: 'p' };

describe('API /api/voices', () => {
  beforeEach(() => {
    vi.mocked(getVoicesConfig).mockReturnValue(configured);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns invalid_body for unparseable JSON', async () => {
    const res = await POST(createMockRequest(undefined, async () => {
      throw new Error('bad');
    }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'invalid_body' });
  });

  it('returns invalid_params when id or lang is missing', async () => {
    const res = await POST(createMockRequest({ id: 'song-1' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'invalid_params' });
  });

  it('returns unconfigured when the voices instance is not set up', async () => {
    vi.mocked(getVoicesConfig).mockReturnValue(null);
    const res = await POST(createMockRequest({ id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'unconfigured' });
  });

  it('returns grouped voice sections on success', async () => {
    const groups = [{ gender: 'Boy', sections: [] }];
    vi.mocked(getVoiceSections).mockResolvedValue(groups as any);
    const res = await POST(createMockRequest({ id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, data: { groups } });
    expect(getVoiceSections).toHaveBeenCalledWith('song-1', 'en');
  });

  it('returns search_failed when lookup throws', async () => {
    vi.mocked(getVoiceSections).mockRejectedValueOnce(new Error('nope'));
    const res = await POST(createMockRequest({ id: 'song-1', lang: 'en' }));
    const data = await res.json();
    expect(data).toEqual({ ok: false, error: 'search_failed' });
  });
});
