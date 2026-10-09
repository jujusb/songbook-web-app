import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET as albumsGET, POST as albumsPOST } from '@/app/api/albums/route';
import { createTempContentDir, mockContentDir } from '../../../utils/temp-content';
import { createUser, createSession, createAlbum } from '@/lib/auth';

function createMockRequest(method: string, body?: unknown, url = 'http://localhost/api/albums') {
  return {
    method,
    url,
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/albums', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let reviewerToken: string;
  
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    mockContentDir(tempDir);
    
    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    
    await createUser('reviewer', 'reviewerpass', 'reviewer');
    reviewerToken = await createSession({ id: 'reviewer', username: 'reviewer', role: 'reviewer' });
  });
  
  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  async function mockAuth(token: string | undefined) {
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) => name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined),
    } as any);
  }

  describe('GET /api/albums', () => {
    it('returns empty list when no albums exist', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('GET');
      const response = await albumsGET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('returns all albums for admin', async () => {
      await createAlbum('album-1', 'Album One', 'various-artists');
      await createAlbum('album-2', 'Album Two', 'various-artists');
      
      mockAuth(adminToken);
      const req = createMockRequest('GET');
      const response = await albumsGET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it('returns published albums for public users', async () => {
      const { saveAlbum } = await import('@/lib/content');
      await createAlbum('published-album', 'Published Album', 'various-artists');
      await createAlbum('draft-album', 'Draft Album', 'various-artists');
      
      const published = await import('@/lib/content').then(m => m.getAlbum('published-album'));
      published.published = true;
      await saveAlbum(published);
      
      mockAuth(undefined);
      const req = createMockRequest('GET');
      const response = await albumsGET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.map((a: any) => a.id)).toEqual(['published-album']);
    });
  });

  describe('POST /api/albums', () => {
    it('creates new album with valid data', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'new-album',
        title: 'New Album',
        artist: 'various-artists',
        year: 2024,
        number: 1,
      });
      
      const response = await albumsPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBe('new-album');
    });

    it('returns 400 for missing required fields', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        title: 'No ID or Artist',
      });
      
      const response = await albumsPOST(req);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('READ_ONLY', 'true');
      
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'test-album',
        title: 'Test Album',
        artist: 'various-artists',
      });
      
      const response = await albumsPOST(req);
      
      expect(response.status).toBe(403);
      vi.unstubAllEnvs();
    });

    it('returns 403 for non-admin users', async () => {
      mockAuth(reviewerToken);
      const req = createMockRequest('POST', {
        id: 'reviewer-album',
        title: 'Reviewer Album',
        artist: 'various-artists',
      });
      
      const response = await albumsPOST(req);
      expect(response.status).toBe(403);
    });
  });
});