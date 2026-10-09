import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';
import { GET, POST, DELETE } from '@/app/api/songs/route';
import { createTempContentDir } from '../../utils/temp-content';
import { createUser, createSession, getUser } from '@/lib/auth';

function createMockRequest(method: string, body?: unknown, url = 'http://localhost/api/songs') {
  return {
    method,
    url,
    json: async () => body,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Request;
}

describe('API /api/songs', () => {
  let tempDir: Awaited<ReturnType<typeof createTempContentDir>>;
  let adminToken: string;
  let reviewerToken: string;
  
  beforeEach(async () => {
    tempDir = await createTempContentDir();
    
    await createUser('admin', 'adminpass', 'admin');
    adminToken = await createSession({ id: 'admin', username: 'admin', role: 'admin' });
    
    await createUser('reviewer', 'reviewerpass', 'reviewer');
    reviewerToken = await createSession({ id: 'reviewer', username: 'reviewer', role: 'reviewer' });
  });
  
  afterEach(async () => {
    await tempDir.cleanup();
    vi.clearAllMocks();
  });

  function mockAuth(token: string | undefined) {
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn((name) => name === 'songbook-session' ? (token ? { value: token } : undefined) : undefined),
    } as any);
  }

  describe('GET /api/songs', () => {
    it('returns empty list when no songs exist', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('GET');
      const response = await GET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('returns all songs for admin with all=true', async () => {
      const { createSong } = await import('@/lib/content');
      await createSong('song1', 'Song 1', 'en');
      await createSong('song2', 'Song 2', 'en');
      
      mockAuth(adminToken);
      const req = createMockRequest('GET', undefined, 'http://localhost/api/songs?all=true');
      const response = await GET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it('returns 401 for non-admin requesting all=true', async () => {
      mockAuth(reviewerToken);
      const req = createMockRequest('GET', undefined, 'http://localhost/api/songs?all=true');
      const response = await GET(req);
      
      expect(response.status).toBe(401);
    });

    it('returns published songs for public users', async () => {
      const { createSong, saveSongTranslation } = await import('@/lib/content');
      await createSong('published-song', 'Published Song', 'en');
      await createSong('draft-song', 'Draft Song', 'en');
      
      await saveSongTranslation('published-song', 'en', {
        language: 'en', status: 'final', published: true
      }, '{title: Published}\nContent');
      
      await saveSongTranslation('draft-song', 'en', {
        language: 'en', status: 'draft', published: false
      }, '{title: Draft}\nContent');
      
      mockAuth(undefined); // No session = public
      const req = createMockRequest('GET');
      const response = await GET(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.map((s: any) => s.id)).toEqual(['published-song']);
    });
  });

  describe('POST /api/songs', () => {
    it('creates new song with valid data', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'new-song',
        title: 'New Song',
        lang: 'en',
      });
      
      const response = await POST(req);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBe('new-song');
    });

    it('returns 400 for missing id or title', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', { title: 'No ID' });
      const response = await POST(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('id and title are required');
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      
      mockAuth(adminToken);
      const req = createMockRequest('POST', { id: 'test', title: 'Test' });
      const response = await POST(req);
      
      expect(response.status).toBe(403);
      vi.unstubAllEnvs();
    });

    it('creates song in specified album', async () => {
      const { createAlbum } = await import('@/lib/content');
      await createAlbum('test-album', 'Test Album', 'various-artists');
      
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'album-song',
        title: 'Album Song',
        lang: 'en',
        albumId: 'test-album',
      });
      
      const response = await POST(req);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBe('album-song');
    });

    it('accepts chordpro content on creation', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('POST', {
        id: 'chordpro-song',
        title: 'ChordPro Song',
        lang: 'en',
        chordpro: '{title: ChordPro Song}\n\n{verse: 1}\n[C]Content [G]here',
      });
      
      const response = await POST(req);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      
      const { getSongTranslation } = await import('@/lib/content');
      const { body } = await getSongTranslation('chordpro-song', 'en');
      expect(body).toContain('[C]Content [G]here');
    });
  });

  describe('DELETE /api/songs', () => {
    it('deletes existing song', async () => {
      const { createSong } = await import('@/lib/content');
      await createSong('song-to-delete', 'Song to Delete', 'en');
      
      mockAuth(adminToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/songs?id=song-to-delete');
      const response = await DELETE(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for missing id', async () => {
      mockAuth(adminToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/songs');
      const response = await DELETE(req);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('id is required');
    });

    it('returns 403 in read-only mode', async () => {
      vi.stubEnv('SONGBOOK_READONLY', '1');
      
      mockAuth(adminToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/songs?id=test');
      const response = await DELETE(req);
      
      expect(response.status).toBe(403);
      vi.unstubAllEnvs();
    });

    it('returns 403 for non-admin users', async () => {
      const { createSong } = await import('@/lib/content');
      await createSong('protected-song', 'Protected Song', 'en');
      
      mockAuth(reviewerToken);
      const req = createMockRequest('DELETE', undefined, 'http://localhost/api/songs?id=protected-song');
      const response = await DELETE(req);
      
      expect(response.status).toBe(403);
    });
  });
});