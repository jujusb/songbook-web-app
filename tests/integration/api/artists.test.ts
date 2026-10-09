import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/artists/route';
import { createTempContentDir, mockContentDir } from '../../utils/temp-content';
import { listArtists } from '@/lib/content';

vi.mock('@/lib/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content')>();
  return {
    ...actual,
    listArtists: vi.fn(actual.listArtists),
  };
});

function createMockRequest(method: string, body?: unknown, url = 'http://localhost/api/artists') {
  return {
    method,
    url,
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/artists', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;

  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
  });

  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('GET /api/artists', () => {
    it('lists existing artists', async () => {
      const res = await GET();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.map((a: any) => a.id)).toContain('various-artists');
    });

    it('returns 500 when listing throws', async () => {
      vi.mocked(listArtists).mockRejectedValueOnce(new Error('boom'));
      const res = await GET();
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Failed to list artists');
    });
  });

  describe('POST /api/artists', () => {
    it('creates an artist', async () => {
      const req = createMockRequest('POST', { id: 'new-artist', name: 'New Artist', tags: [] });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data).toEqual({ success: true, id: 'new-artist' });
    });

    it('returns 400 for invalid body', async () => {
      const req = createMockRequest('POST', { name: 'No ID' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(typeof data.error).toBe('string');
    });

    it('returns 400 when the request body cannot be parsed', async () => {
      const req = {
        json: async () => {
          throw new Error('bad json');
        },
      } as unknown as Request;
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      const req = createMockRequest('POST', { id: 'x', name: 'X' });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/artists', () => {
    it('updates an artist', async () => {
      const req = createMockRequest('PUT', { id: 'various-artists', name: 'Updated', tags: [] });
      const res = await PUT(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, id: 'various-artists' });
    });

    it('returns 400 for invalid body', async () => {
      const req = createMockRequest('PUT', { name: 'Missing id' });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      const req = createMockRequest('PUT', { id: 'x', name: 'X' });
      const res = await PUT(req);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/artists', () => {
    it('deletes an artist by id query param', async () => {
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/artists?id=various-artists');
      const res = await DELETE(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it('returns 400 when id is missing', async () => {
      const req = createMockRequest('DELETE');
      const res = await DELETE(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('id is required');
    });

    it('returns 500 when delete fails', async () => {
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/artists?id=does-not-exist');
      const res = await DELETE(req);
      expect(res.status).toBe(500);
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/artists?id=x');
      const res = await DELETE(req);
      expect(res.status).toBe(403);
    });
  });
});
